from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.api.presenters import serialize_order
from app.core.config import settings
from app.db.session import get_db
from app.models.order import StoreOrder
from app.models.payment import PaymentWebhookEvent
from app.models.store import MerchantPaymentAccount, Store
from app.services.delivery import publish_order_snapshot
from app.services.mercadopago import (
    MercadoPagoAPIError,
    fetch_payment,
    get_or_create_mercadopago_provider,
    get_provider_webhook_secret,
    normalize_payment_status,
)
from app.services.order_runtime import build_order_options
from app.services.payment_transactions import (
    PaymentValidationError,
    create_payment_transaction,
    create_webhook_event,
    find_transaction_by_payment_id,
    find_transaction_by_reference,
    record_payment_result,
    validate_mercadopago_webhook_signature,
    validate_payment_matches_transaction,
)

router = APIRouter()


def _order_options(db: Session) -> tuple[object, ...]:
    return build_order_options(
        db,
        selectinload(StoreOrder.items),
        selectinload(StoreOrder.store),
        selectinload(StoreOrder.address),
        selectinload(StoreOrder.delivery_assignment),
    )


def _get_nested_value(payload: dict[str, Any], path: str) -> Any:
    current: Any = payload
    for part in path.split("."):
        if not isinstance(current, dict):
            return None
        current = current.get(part)
    return current


def _load_order(db: Session, reference: str) -> StoreOrder | None:
    return db.scalar(
        select(StoreOrder)
        .options(*_order_options(db))
        .where(StoreOrder.payment_reference == reference)
    )


def _load_store(db: Session, store_id: int) -> Store | None:
    return db.scalar(
        select(Store)
        .options(selectinload(Store.payment_accounts), selectinload(Store.payment_settings))
        .where(Store.id == store_id)
    )


def _connected_mercadopago_stores(db: Session) -> list[Store]:
    return db.scalars(
        select(Store)
        .join(MerchantPaymentAccount, MerchantPaymentAccount.store_id == Store.id)
        .options(selectinload(Store.payment_accounts), selectinload(Store.payment_settings))
        .where(
            MerchantPaymentAccount.provider == "mercadopago",
            MerchantPaymentAccount.connected.is_(True),
            MerchantPaymentAccount.access_token_encrypted.is_not(None),
            MerchantPaymentAccount.reconnect_required.is_(False),
        )
        .order_by(Store.id.asc())
    ).all()


def _fetch_payment_for_webhook(
    db: Session,
    *,
    payment_id: str | int,
    store: Store | None,
) -> tuple[dict[str, Any], Store]:
    if store is not None:
        return fetch_payment(payment_id, store), store

    last_error: MercadoPagoAPIError | None = None
    for candidate_store in _connected_mercadopago_stores(db):
        try:
            return fetch_payment(payment_id, candidate_store), candidate_store
        except MercadoPagoAPIError as exc:
            last_error = exc
            continue
    if last_error is not None:
        raise last_error
    raise MercadoPagoAPIError("No connected Mercado Pago merchant account is available")


def _apply_payment_status(order: StoreOrder, status_value: str) -> None:
    if order.payment_status == "approved" and status_value != "approved":
        return
    if order.payment_status == "cancelled" and status_value == "pending":
        return
    order.payment_status = status_value
    if status_value in {"cancelled", "rejected"}:
        order.status = "cancelled"


@router.post("/mercadopago/webhook")
async def mercadopago_webhook(
    request: Request, db: Session = Depends(get_db)
) -> dict[str, object]:
    query_params = request.query_params
    raw_body = await request.body()
    payload: dict[str, Any] = {}
    if raw_body:
        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            payload = {}

    simulated_reference = payload.get("reference")
    simulated_status = payload.get("status")
    if simulated_reference and simulated_status:
        if not settings.mercadopago_simulated:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Simulated Mercado Pago webhook is disabled")
        order = _load_order(db, str(simulated_reference))
        if order is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
        _apply_payment_status(order, str(simulated_status))
        transaction = find_transaction_by_reference(db, str(simulated_reference))
        if transaction is not None:
            transaction.status = str(simulated_status)
            transaction.status_detail = "simulated"
        db.commit()
        db.refresh(order)
        publish_order_snapshot(order, event_type="payment.updated")
        return serialize_order(order).model_dump()

    event_type = (
        query_params.get("type")
        or query_params.get("topic")
        or payload.get("type")
        or payload.get("topic")
    )
    if event_type not in {None, "", "payment"}:
        return {"status": "ignored", "reason": "unsupported_event"}

    reference = (
        query_params.get("reference")
        or payload.get("reference")
        or _get_nested_value(payload, "data.external_reference")
    )
    payment_id = (
        query_params.get("data.id")
        or query_params.get("id")
        or _get_nested_value(payload, "data.id")
        or payload.get("id")
    )
    if payment_id is None:
        return {"status": "ignored", "reason": "missing_payment_id"}

    provider = get_or_create_mercadopago_provider(db)
    try:
        webhook_secret = get_provider_webhook_secret(provider)
    except MercadoPagoAPIError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    data_id = str(query_params.get("data.id") or _get_nested_value(payload, "data.id") or payment_id)
    request_id = request.headers.get("x-request-id")
    signature_valid = validate_mercadopago_webhook_signature(
        data_id=data_id,
        request_id=request_id,
        signature_header=request.headers.get("x-signature"),
        secret=webhook_secret,
    )
    if not signature_valid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid Mercado Pago webhook signature")

    event_id = str(payment_id)
    existing_event = db.scalar(
        select(PaymentWebhookEvent).where(
            PaymentWebhookEvent.provider == "mercadopago",
            PaymentWebhookEvent.event_id == event_id,
            PaymentWebhookEvent.request_id == request_id,
        )
    )
    if existing_event is not None and existing_event.processed_at is not None:
        return {"status": "ignored", "reason": "duplicate_event"}
    event = existing_event or create_webhook_event(
        db,
        event_id=event_id,
        request_id=request_id,
        payment_id=str(payment_id),
        external_reference=str(reference) if reference else None,
        signature_valid=True,
        payload=payload,
    )

    store_id_raw = query_params.get("store_id") or payload.get("store_id")
    order = _load_order(db, reference) if reference else None
    store = None
    if store_id_raw:
        store = _load_store(db, int(store_id_raw))
        if store is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")
    elif order is not None:
        store = _load_store(db, order.store_id)
        if store is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")

    try:
        payment, store = _fetch_payment_for_webhook(db, payment_id=payment_id, store=store)
    except MercadoPagoAPIError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    reference_from_payment = payment.get("external_reference")
    effective_reference = str(reference_from_payment or reference or "")
    if not effective_reference:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment reference not found")

    if order is None or order.payment_reference != effective_reference:
        order = _load_order(db, effective_reference)
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if store.id != order.store_id:
        store = _load_store(db, order.store_id)
        if store is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")

    transaction = find_transaction_by_reference(db, effective_reference) or find_transaction_by_payment_id(db, payment_id)
    if transaction is None:
        transaction = create_payment_transaction(
            db,
            order=order,
            store=store,
            external_reference=effective_reference,
        )

    status_value = normalize_payment_status(payment.get("status"))
    try:
        validate_payment_matches_transaction(
            transaction=transaction,
            order=order,
            store=store,
            provider_mode=str(provider.mode or "sandbox"),
            payment=payment,
            status_value=status_value,
        )
    except PaymentValidationError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    record_payment_result(transaction, payment=payment, status_value=status_value)
    event.external_reference = effective_reference
    event.processed_at = datetime.now(UTC)
    _apply_payment_status(order, status_value)
    db.commit()
    db.refresh(order)
    publish_order_snapshot(order, event_type="payment.updated")
    return serialize_order(order).model_dump()
