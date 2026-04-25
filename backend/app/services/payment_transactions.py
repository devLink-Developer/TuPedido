from __future__ import annotations

import hashlib
import hmac
import json
from datetime import UTC, datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.payment import PaymentTransaction, PaymentWebhookEvent
from app.services.mercadopago import MERCADOPAGO_PROVIDER, get_store_payment_account

MONEY_QUANTIZER = Decimal("0.01")
PAYMENT_CURRENCY = "ARS"
REDACTED_KEYS = {"access_token", "refresh_token", "token", "authorization", "client_secret"}


class PaymentValidationError(RuntimeError):
    pass


def _money(value: object) -> Decimal:
    return Decimal(str(value or 0)).quantize(MONEY_QUANTIZER, rounding=ROUND_HALF_UP)


def _money_or_none(value: object) -> Decimal | None:
    if value is None:
        return None
    return _money(value)


def _serialize_json(value: object) -> str:
    return json.dumps(_redact_payload(value), ensure_ascii=True, sort_keys=True, default=str)


def _redact_payload(value: object) -> object:
    if isinstance(value, dict):
        return {
            key: "***" if key.lower() in REDACTED_KEYS else _redact_payload(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_redact_payload(item) for item in value]
    return value


def _nested_value(payload: dict[str, Any], path: str) -> Any:
    current: Any = payload
    for segment in path.split("."):
        if not isinstance(current, dict):
            return None
        current = current.get(segment)
    return current


def _extract_collector_id(payment: dict[str, Any]) -> str | None:
    collector_id = payment.get("collector_id") or _nested_value(payment, "collector.id")
    return str(collector_id) if collector_id is not None else None


def _extract_marketplace_fee(payment: dict[str, Any]) -> Decimal | None:
    for key in ("marketplace_fee", "marketplace_amount", "application_fee"):
        value = payment.get(key)
        if value is not None:
            return _money(value)
    for item in payment.get("fee_details") or []:
        if not isinstance(item, dict):
            continue
        fee_type = str(item.get("type") or "").lower()
        if "marketplace" in fee_type or "application" in fee_type:
            return _money(item.get("amount"))
    return None


def create_payment_transaction(
    db: Session,
    *,
    order: object,
    store: object,
    external_reference: str,
    idempotency_key: str | None = None,
) -> PaymentTransaction:
    account = get_store_payment_account(store)
    amount_total = _money(getattr(order, "total", 0))
    service_fee = _money(getattr(order, "service_fee", 0))
    delivery_fee = _money(getattr(order, "delivery_fee_customer", getattr(order, "delivery_fee", 0)) or 0)
    transaction = PaymentTransaction(
        order_id=getattr(order, "id"),
        store_id=getattr(store, "id"),
        provider=MERCADOPAGO_PROVIDER,
        external_reference=external_reference,
        idempotency_key=(idempotency_key or "").strip() or None,
        status="pending",
        amount_total=amount_total,
        currency=PAYMENT_CURRENCY,
        requested_marketplace_fee=service_fee,
        seller_expected_amount=amount_total - service_fee,
        delivery_fee_amount=delivery_fee,
        service_fee_amount=service_fee,
        mp_user_id=getattr(account, "mp_user_id", None) if account else None,
        live_mode=getattr(account, "live_mode", None) if account else None,
    )
    db.add(transaction)
    db.flush()
    return transaction


def attach_preference(transaction: PaymentTransaction, preference: dict[str, Any]) -> None:
    transaction.preference_id = str(preference.get("id") or "") or transaction.preference_id
    transaction.checkout_url = str(preference.get("checkout_url") or "") or transaction.checkout_url
    transaction.preference_raw_json = _serialize_json(preference.get("raw") or preference)


def attach_simulated_checkout(transaction: PaymentTransaction, checkout_url: str) -> None:
    transaction.preference_id = f"simulated_{transaction.external_reference}"
    transaction.checkout_url = checkout_url


def record_payment_result(
    transaction: PaymentTransaction,
    *,
    payment: dict[str, Any],
    status_value: str,
) -> None:
    payment_id = payment.get("id")
    if payment_id is not None:
        transaction.payment_id = str(payment_id)
    transaction.status = status_value
    transaction.status_detail = str(payment.get("status_detail") or "") or None
    transaction.approved_marketplace_fee = _extract_marketplace_fee(payment)
    transaction.raw_payment_json = _serialize_json(payment)
    live_mode = payment.get("live_mode")
    if live_mode is not None:
        transaction.live_mode = bool(live_mode)
    if status_value == "approved" and transaction.approved_at is None:
        transaction.approved_at = datetime.now(UTC)


def validate_payment_matches_transaction(
    *,
    transaction: PaymentTransaction,
    order: object,
    store: object,
    provider_mode: str,
    payment: dict[str, Any],
    status_value: str,
) -> None:
    reference = str(payment.get("external_reference") or "")
    if reference and reference != transaction.external_reference:
        raise PaymentValidationError("Mercado Pago payment reference does not match the local transaction")

    transaction_amount = _money_or_none(payment.get("transaction_amount"))
    if transaction_amount is None:
        transaction_amount = _money_or_none(_nested_value(payment, "transaction_details.total_paid_amount"))
    if transaction_amount is None or transaction_amount != _money(transaction.amount_total):
        raise PaymentValidationError("Mercado Pago payment amount does not match the order total")

    currency = str(payment.get("currency_id") or transaction.currency or "").upper()
    if currency != PAYMENT_CURRENCY:
        raise PaymentValidationError("Mercado Pago payment currency does not match ARS")

    expected_collector_id = str(transaction.mp_user_id or "")
    collector_id = _extract_collector_id(payment)
    if expected_collector_id and collector_id and collector_id != expected_collector_id:
        raise PaymentValidationError("Mercado Pago collector does not match the merchant account")
    if expected_collector_id and not collector_id:
        raise PaymentValidationError("Mercado Pago payment did not include collector information")

    expected_live_mode = (
        bool(transaction.live_mode)
        if transaction.live_mode is not None
        else str(provider_mode or "sandbox").lower() == "production"
    )
    payment_live_mode = payment.get("live_mode")
    if payment_live_mode is None:
        raise PaymentValidationError("Mercado Pago payment did not include live_mode")
    if bool(payment_live_mode) != expected_live_mode:
        raise PaymentValidationError("Mercado Pago payment mode does not match the transaction mode")

    marketplace_fee = _extract_marketplace_fee(payment)
    if status_value == "approved" and marketplace_fee is None:
        raise PaymentValidationError("Mercado Pago payment did not include marketplace_fee")
    if marketplace_fee is not None and marketplace_fee != _money(transaction.requested_marketplace_fee):
        raise PaymentValidationError("Mercado Pago marketplace_fee does not match the service fee")

    if getattr(order, "id", None) != transaction.order_id or getattr(store, "id", None) != transaction.store_id:
        raise PaymentValidationError("Mercado Pago payment does not match the local order/store")


def find_transaction_by_reference(db: Session, reference: str) -> PaymentTransaction | None:
    return db.scalar(
        select(PaymentTransaction).where(
            PaymentTransaction.provider == MERCADOPAGO_PROVIDER,
            PaymentTransaction.external_reference == reference,
        )
    )


def find_transaction_by_payment_id(db: Session, payment_id: str | int) -> PaymentTransaction | None:
    return db.scalar(
        select(PaymentTransaction).where(
            PaymentTransaction.provider == MERCADOPAGO_PROVIDER,
            PaymentTransaction.payment_id == str(payment_id),
        )
    )


def parse_mercadopago_signature(value: str | None) -> tuple[str | None, str | None]:
    if not value:
        return None, None
    timestamp = None
    signature = None
    for part in value.split(","):
        key, _, raw_value = part.partition("=")
        if key.strip() == "ts":
            timestamp = raw_value.strip()
        elif key.strip() == "v1":
            signature = raw_value.strip()
    return timestamp, signature


def validate_mercadopago_webhook_signature(
    *,
    data_id: str | None,
    request_id: str | None,
    signature_header: str | None,
    secret: str,
) -> bool:
    timestamp, signature = parse_mercadopago_signature(signature_header)
    if not data_id or not request_id or not timestamp or not signature or not secret:
        return False
    try:
        raw_timestamp = int(timestamp)
    except ValueError:
        return False
    timestamp_seconds = raw_timestamp / 1000 if raw_timestamp > 9_999_999_999 else float(raw_timestamp)
    tolerance = max(0, int(settings.mercadopago_webhook_signature_tolerance_seconds or 0))
    if tolerance and abs(datetime.now(UTC).timestamp() - timestamp_seconds) > tolerance:
        return False
    manifest = f"id:{data_id};request-id:{request_id};ts:{timestamp};"
    digest = hmac.new(secret.encode("utf-8"), msg=manifest.encode("utf-8"), digestmod=hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, signature)


def create_webhook_event(
    db: Session,
    *,
    event_id: str,
    request_id: str | None,
    payment_id: str | None,
    external_reference: str | None,
    signature_valid: bool,
    payload: dict[str, Any],
) -> PaymentWebhookEvent:
    event = PaymentWebhookEvent(
        provider=MERCADOPAGO_PROVIDER,
        event_id=event_id,
        request_id=request_id,
        payment_id=str(payment_id) if payment_id is not None else None,
        external_reference=external_reference,
        signature_valid=signature_valid,
        payload_json=_serialize_json(payload),
    )
    db.add(event)
    db.flush()
    return event
