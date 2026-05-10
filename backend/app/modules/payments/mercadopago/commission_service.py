from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.orm import Session

from app.models.platform import PaymentProvider
from app.services.mercadopago import get_or_create_mercadopago_provider

MONEY_QUANTIZER = Decimal("0.01")


def _money(value: object) -> Decimal:
    return Decimal(str(value or 0)).quantize(MONEY_QUANTIZER, rounding=ROUND_HALF_UP)


def calculate_marketplace_fee(
    db: Session,
    *,
    gross_amount: object,
    fallback_fixed_fee: object = 0,
    provider: PaymentProvider | None = None,
) -> Decimal:
    resolved_provider = provider or get_or_create_mercadopago_provider(db)
    gross = _money(gross_amount)
    if gross <= 0:
        return Decimal("0.00")

    mode = str(getattr(resolved_provider, "commission_mode", "fixed") or "fixed").lower()
    configured_value = getattr(resolved_provider, "commission_value", None)
    value = _money(configured_value if configured_value is not None else fallback_fixed_fee)

    if mode == "percentage":
        fee = (gross * value / Decimal("100")).quantize(MONEY_QUANTIZER, rounding=ROUND_HALF_UP)
    else:
        fee = value
    return min(max(fee, Decimal("0.00")), gross)
