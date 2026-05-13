from __future__ import annotations

from typing import Any

PAID_MERCADOPAGO_STATUSES = {"approved", "paid"}


def payment_status_allows_fulfillment(value: Any) -> bool:
    return str(value or "").strip().lower() in PAID_MERCADOPAGO_STATUSES


def order_visible_to_merchant(order: Any) -> bool:
    if str(getattr(order, "payment_method", "") or "").lower() != "mercadopago":
        return True
    return payment_status_allows_fulfillment(getattr(order, "payment_status", None))


def payment_status_revealed_order_to_merchant(order: Any, previous_payment_status: Any) -> bool:
    return (
        str(getattr(order, "payment_method", "") or "").lower() == "mercadopago"
        and not payment_status_allows_fulfillment(previous_payment_status)
        and order_visible_to_merchant(order)
    )
