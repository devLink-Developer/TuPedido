from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

import httpx
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.models.order import StoreOrder
from app.models.payment import PaymentTransaction
from app.models.store import Store
from app.schemas.order import MercadoPagoCardPaymentRequest, MercadoPagoCardPaymentResponse, MercadoPagoPaymentSessionRead
from app.services.mercadopago import (
    MERCADOPAGO_PROVIDER,
    MercadoPagoAPIError,
    _build_headers,
    build_webhook_url,
    ensure_valid_store_access_token,
    fetch_payment,
    get_or_create_mercadopago_provider,
    normalize_payment_status,
)
from app.services.order_visibility import payment_status_revealed_order_to_merchant
from app.services.payment_transactions import (
    PaymentValidationError,
    record_payment_result,
    validate_payment_matches_transaction,
)

logger = logging.getLogger(__name__)

MONEY_QUANTIZER = Decimal("0.01")


def _now_utc() -> datetime:
    return datetime.now(UTC)


def _money(value: object) -> Decimal:
    return Decimal(str(value or 0)).quantize(MONEY_QUANTIZER, rounding=ROUND_HALF_UP)


def _money_float(value: object) -> float:
    return float(_money(value))


def _session_expiration() -> datetime:
    minutes = max(5, int(settings.mercadopago_payment_session_expire_minutes or 30))
    return _now_utc() + timedelta(minutes=minutes)


def build_card_payment_session_token(transaction: PaymentTransaction) -> tuple[str, datetime]:
    expires_at = _session_expiration()
    payload = {
        "kind": "mercadopago_card_payment_session",
        "provider": MERCADOPAGO_PROVIDER,
        "transaction_id": transaction.id,
        "order_id": transaction.order_id,
        "store_id": transaction.store_id,
        "external_reference": transaction.external_reference,
        "exp": expires_at,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm), expires_at


def decode_card_payment_session_token(value: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(value, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise MercadoPagoAPIError("Mercado Pago payment session is invalid or expired") from exc
    if payload.get("kind") != "mercadopago_card_payment_session" or payload.get("provider") != MERCADOPAGO_PROVIDER:
        raise MercadoPagoAPIError("Mercado Pago payment session is invalid")
    return payload


def build_card_payment_checkout_url(session_token: str) -> str:
    base_url = (settings.mercadopago_card_payment_base_url or settings.frontend_base_url).rstrip("/")
    return f"{base_url}/payments/mercadopago/card?session={session_token}"


def load_payment_session_transaction(db: Session, session_token: str) -> PaymentTransaction:
    payload = decode_card_payment_session_token(session_token)
    transaction = db.scalar(
        select(PaymentTransaction)
        .options(
            selectinload(PaymentTransaction.order).selectinload(StoreOrder.items),
            selectinload(PaymentTransaction.order).selectinload(StoreOrder.user),
            selectinload(PaymentTransaction.store).selectinload(Store.payment_accounts),
        )
        .where(
            PaymentTransaction.id == int(payload["transaction_id"]),
            PaymentTransaction.order_id == int(payload["order_id"]),
            PaymentTransaction.store_id == int(payload["store_id"]),
            PaymentTransaction.provider == MERCADOPAGO_PROVIDER,
            PaymentTransaction.external_reference == str(payload["external_reference"]),
        )
    )
    if transaction is None:
        raise MercadoPagoAPIError("Mercado Pago payment session was not found")
    expires_at = getattr(transaction, "payment_session_expires_at", None)
    if expires_at is not None:
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=UTC)
        if expires_at < _now_utc():
            raise MercadoPagoAPIError("Mercado Pago payment session expired")
    return transaction


def get_payment_session(db: Session, session_token: str) -> MercadoPagoPaymentSessionRead:
    transaction = load_payment_session_transaction(db, session_token)
    provider = get_or_create_mercadopago_provider(db)
    public_key = getattr(provider, "public_key", None) or settings.mercadopago_public_key
    if settings.mercadopago_simulated and not public_key:
        public_key = "TEST-SIMULATED-PUBLIC-KEY"
    if not public_key:
        raise MercadoPagoAPIError("Mercado Pago public key is not configured")

    order = transaction.order
    return MercadoPagoPaymentSessionRead(
        session_token=session_token,
        public_key=public_key,
        order_id=transaction.order_id,
        store_id=transaction.store_id,
        store_name=getattr(order, "store_name_snapshot", None) or getattr(transaction.store, "name", "Comercio"),
        external_reference=transaction.external_reference,
        amount=_money_float(getattr(transaction, "gross_amount", transaction.amount_total)),
        marketplace_fee=_money_float(getattr(transaction, "marketplace_fee", transaction.requested_marketplace_fee)),
        net_amount=_money_float(getattr(transaction, "net_amount", 0)),
        currency=str(getattr(transaction, "currency", "ARS") or "ARS"),
        status=str(getattr(transaction, "status", "pending") or "pending"),
        mode=str(getattr(provider, "mode", "sandbox") or "sandbox"),
        simulated=bool(settings.mercadopago_simulated),
        expires_at=getattr(transaction, "payment_session_expires_at", None),
    )


def _payer_payload(payload: MercadoPagoCardPaymentRequest, order: StoreOrder) -> dict[str, Any]:
    payer: dict[str, Any] = {"email": payload.payer.email}
    identification = payload.payer.identification
    if identification and identification.type and identification.number:
        payer["identification"] = {
            "type": identification.type,
            "number": identification.number,
        }
    elif getattr(order, "user", None) is not None and getattr(order.user, "email", None):
        payer["email"] = payload.payer.email or order.user.email
    return payer


def _create_simulated_payment(transaction: PaymentTransaction, payload: MercadoPagoCardPaymentRequest) -> dict[str, Any]:
    return {
        "id": f"simulated_{transaction.id}",
        "status": "approved",
        "status_detail": "accredited",
        "transaction_amount": _money_float(transaction.gross_amount),
        "currency_id": transaction.currency,
        "external_reference": transaction.external_reference,
        "application_fee": _money_float(transaction.marketplace_fee),
        "collector_id": transaction.mp_user_id,
        "live_mode": False,
        "payment_method_id": payload.payment_method_id,
    }


def _build_payment_payload(transaction: PaymentTransaction, payload: MercadoPagoCardPaymentRequest) -> dict[str, Any]:
    order = transaction.order
    request_payload: dict[str, Any] = {
        "transaction_amount": _money_float(transaction.gross_amount),
        "token": payload.token,
        "description": f"Pedido #{transaction.order_id}",
        "installments": payload.installments,
        "payment_method_id": payload.payment_method_id,
        "payer": _payer_payload(payload, order),
        "application_fee": _money_float(transaction.marketplace_fee),
        "external_reference": transaction.external_reference,
        "notification_url": build_webhook_url(),
        "metadata": {
            "order_id": transaction.order_id,
            "store_id": transaction.store_id,
            "platform": "kepedimos",
        },
    }
    if payload.issuer_id is not None:
        request_payload["issuer_id"] = payload.issuer_id
    return request_payload


def create_card_payment(db: Session, payload: MercadoPagoCardPaymentRequest) -> tuple[MercadoPagoCardPaymentResponse, bool]:
    transaction = load_payment_session_transaction(db, payload.session_token)
    order = transaction.order
    store = transaction.store
    if order is None or store is None:
        raise MercadoPagoAPIError("Payment session is incomplete")
    if transaction.status in {"paid", "processing"} and transaction.payment_id:
        return (
            MercadoPagoCardPaymentResponse(
                order_id=transaction.order_id,
                payment_id=transaction.payment_id,
                status=transaction.status,
                provider_status=transaction.provider_status,
                status_detail=transaction.status_detail,
                external_reference=transaction.external_reference,
            ),
            False,
        )

    if _money(payload.transaction_amount) != _money(transaction.gross_amount):
        raise MercadoPagoAPIError("Payment amount does not match the order")
    if not settings.mercadopago_simulated and not payload.token:
        raise MercadoPagoAPIError("Card token is required")

    logger.info(
        "mercadopago_card_payment_request",
        extra={"order_id": transaction.order_id, "store_id": transaction.store_id, "transaction_id": transaction.id},
    )

    if settings.mercadopago_simulated:
        payment = _create_simulated_payment(transaction, payload)
    else:
        access_token = ensure_valid_store_access_token(store)
        request_payload = _build_payment_payload(transaction, payload)
        headers = _build_headers(access_token)
        headers["X-Idempotency-Key"] = transaction.idempotency_key or f"mp_payment_{transaction.id}"
        try:
            response = httpx.post(
                f"{settings.mercadopago_api_base_url.rstrip('/')}/v1/payments",
                headers=headers,
                json=request_payload,
                timeout=settings.mercadopago_timeout_seconds,
            )
        except httpx.HTTPError as exc:
            transaction.last_error = str(exc)[:1000]
            transaction.retry_count = int(getattr(transaction, "retry_count", 0) or 0) + 1
            logger.exception("mercadopago_card_payment_failed", extra={"transaction_id": transaction.id})
            raise MercadoPagoAPIError(f"Mercado Pago payment request failed: {exc}") from exc

        if response.status_code not in {200, 201}:
            transaction.last_error = response.text[:1000]
            transaction.retry_count = int(getattr(transaction, "retry_count", 0) or 0) + 1
            logger.warning(
                "mercadopago_card_payment_rejected",
                extra={"transaction_id": transaction.id, "status_code": response.status_code},
            )
            raise MercadoPagoAPIError(f"Mercado Pago payment failed ({response.status_code}): {response.text}")
        payment = response.json()

    status_value = normalize_payment_status(payment.get("status"))
    provider = get_or_create_mercadopago_provider(db)
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
        transaction.last_error = str(exc)
        raise MercadoPagoAPIError(str(exc)) from exc

    previous_payment_status = order.payment_status
    record_payment_result(transaction, payment=payment, status_value=status_value)
    order.payment_status = status_value
    if status_value in {"cancelled", "rejected", "refunded", "chargeback"}:
        order.status = "cancelled"
    return (
        MercadoPagoCardPaymentResponse(
            order_id=transaction.order_id,
            payment_id=transaction.payment_id,
            status=transaction.status,
            provider_status=transaction.provider_status,
            status_detail=transaction.status_detail,
            external_reference=transaction.external_reference,
        ),
        payment_status_revealed_order_to_merchant(order, previous_payment_status),
    )


def sync_transaction_from_provider(db: Session, transaction: PaymentTransaction) -> bool:
    if not transaction.payment_id or transaction.store is None or transaction.order is None:
        return False
    payment = fetch_payment(transaction.payment_id, transaction.store)
    provider = get_or_create_mercadopago_provider(db)
    status_value = normalize_payment_status(payment.get("status"))
    validate_payment_matches_transaction(
        transaction=transaction,
        order=transaction.order,
        store=transaction.store,
        provider_mode=str(provider.mode or "sandbox"),
        payment=payment,
        status_value=status_value,
    )
    record_payment_result(transaction, payment=payment, status_value=status_value)
    transaction.last_sync_at = _now_utc()
    transaction.order.payment_status = status_value
    if status_value in {"cancelled", "rejected", "refunded", "chargeback"}:
        transaction.order.status = "cancelled"
    return True
