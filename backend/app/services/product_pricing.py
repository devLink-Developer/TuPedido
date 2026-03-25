from __future__ import annotations

from typing import Literal

DiscountType = Literal["percentage", "fixed"]


def normalize_discount_type(value: str | None) -> DiscountType | None:
    if value is None:
        return None
    normalized = value.strip().lower()
    if normalized in {"", "none"}:
        return None
    if normalized not in {"percentage", "fixed"}:
        raise ValueError("Unsupported discount type")
    return normalized


def compute_discount_amount(
    *,
    price: float,
    commercial_discount_type: str | None,
    commercial_discount_value: float | None,
) -> float:
    normalized_type = normalize_discount_type(commercial_discount_type)
    value = float(commercial_discount_value or 0)
    if normalized_type is None or value <= 0 or price <= 0:
        return 0.0
    if normalized_type == "percentage":
        return min(round(price * value / 100, 2), price)
    return min(round(value, 2), price)


def compute_final_price(
    *,
    price: float,
    commercial_discount_type: str | None,
    commercial_discount_value: float | None,
) -> float:
    discount_amount = compute_discount_amount(
        price=price,
        commercial_discount_type=commercial_discount_type,
        commercial_discount_value=commercial_discount_value,
    )
    return max(round(price - discount_amount, 2), 0.0)


def serialize_product_pricing(
    *,
    price: float,
    commercial_discount_type: str | None,
    commercial_discount_value: float | None,
) -> dict[str, float | bool | str | None]:
    normalized_type = normalize_discount_type(commercial_discount_type)
    discount_amount = compute_discount_amount(
        price=price,
        commercial_discount_type=normalized_type,
        commercial_discount_value=commercial_discount_value,
    )
    final_price = max(round(price - discount_amount, 2), 0.0)
    discount_percentage = round((discount_amount / price) * 100, 2) if price > 0 else 0.0
    return {
        "commercial_discount_type": normalized_type,
        "commercial_discount_value": float(commercial_discount_value) if commercial_discount_value is not None else None,
        "commercial_discount_amount": discount_amount,
        "commercial_discount_percentage": discount_percentage,
        "final_price": final_price,
        "has_commercial_discount": discount_amount > 0,
    }
