from __future__ import annotations

import json
from typing import Any
from urllib.parse import urlencode

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse

from app.api.presenters import serialize_order
from app.core.config import settings
from app.db.session import get_db
from app.models.order import StoreOrder
from app.models.store import MercadoPagoCredential, Store
from app.services.delivery import publish_order_snapshot
from app.services.mercadopago import (
    MercadoPagoAPIError,
    decode_oauth_state,
    exchange_oauth_code,
    fetch_payment,
    normalize_payment_status,
    store_oauth_credentials,
)

router = APIRouter()


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
        .options(
            selectinload(StoreOrder.items),
            selectinload(StoreOrder.store),
            selectinload(StoreOrder.address),
            selectinload(StoreOrder.delivery_assignment),
        )
        .where(StoreOrder.payment_reference == reference)
    )


def _load_store(db: Session, store_id: int) -> Store | None:
    return db.scalar(
        select(Store)
        .options(selectinload(Store.mercadopago_credentials), selectinload(Store.payment_settings))
        .where(Store.id == store_id)
    )


def _merchant_redirect_url(status_value: str, detail: str | None = None) -> str:
    base = f"{settings.frontend_base_url.rstrip('/')}/merchant"
    query = {"mercadopago_oauth": status_value}
    if detail:
        query["detail"] = detail
    return f"{base}?{urlencode(query)}"


def _apply_payment_status(order: StoreOrder, status_value: str) -> None:
    if order.payment_status == "approved" and status_value != "approved":
        return
    if order.payment_status == "cancelled" and status_value == "pending":
        return
    order.payment_status = status_value
    if status_value in {"cancelled", "rejected"}:
        order.status = "cancelled"


@router.get("/mercadopago/oauth/callback")
def mercadopago_oauth_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
    db: Session = Depends(get_db),
) -> RedirectResponse:
    if error:
        return RedirectResponse(
            _merchant_redirect_url("error", error_description or error),
            status_code=status.HTTP_302_FOUND,
        )
    if not code or not state:
        return RedirectResponse(
            _merchant_redirect_url("error", "Missing OAuth callback parameters"),
            status_code=status.HTTP_302_FOUND,
        )
    try:
        payload = decode_oauth_state(state)
        store = db.scalar(
            select(Store)
            .options(selectinload(Store.mercadopago_credentials), selectinload(Store.payment_settings))
            .where(Store.id == int(payload["store_id"]), Store.owner_user_id == int(payload["user_id"]))
        )
        if store is None:
            raise MercadoPagoAPIError("Merchant store not found for OAuth callback")
        if store.mercadopago_credentials is None:
            credentials = MercadoPagoCredential(store_id=store.id)
            db.add(credentials)
            db.flush()
            store.mercadopago_credentials = credentials
        token_payload = exchange_oauth_code(code)
        store_oauth_credentials(store, token_payload)
        db.commit()
        return RedirectResponse(
            _merchant_redirect_url("connected"),
            status_code=status.HTTP_302_FOUND,
        )
    except (MercadoPagoAPIError, ValueError) as exc:
        db.rollback()
        return RedirectResponse(
            _merchant_redirect_url("error", str(exc)),
            status_code=status.HTTP_302_FOUND,
        )


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
        order = _load_order(db, str(simulated_reference))
        if order is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
        _apply_payment_status(order, str(simulated_status))
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

    store_id_raw = query_params.get("store_id") or payload.get("store_id")
    order = _load_order(db, reference) if reference else None
    store_id = int(store_id_raw) if store_id_raw else (order.store_id if order else None)
    if store_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Store id is required")

    store = _load_store(db, store_id)
    if store is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")

    try:
        payment = fetch_payment(payment_id, store)
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

    _apply_payment_status(order, normalize_payment_status(payment.get("status")))
    db.commit()
    db.refresh(order)
    publish_order_snapshot(order, event_type="payment.updated")
    return serialize_order(order).model_dump()
