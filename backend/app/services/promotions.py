from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.order import OrderPromotionApplication, ShoppingCart, StoreOrder
from app.models.store import StorePromotion, StorePromotionItem

PROMOTION_OPTIONS = (
    selectinload(StorePromotion.items).selectinload(StorePromotionItem.product),
)


@dataclass(slots=True)
class AppliedPromotionSummary:
    promotion_id: int | None
    promotion_name: str
    combo_count: int
    sale_price: float
    base_total: float
    discount_total: float
    items: list[dict[str, object]]


def get_store_promotions(db: Session, store_id: int, *, include_inactive: bool = True) -> list[StorePromotion]:
    query = (
        select(StorePromotion)
        .options(*PROMOTION_OPTIONS)
        .where(StorePromotion.store_id == store_id)
        .order_by(StorePromotion.sort_order.asc(), StorePromotion.id.asc())
    )
    if not include_inactive:
        query = query.where(StorePromotion.is_active.is_(True))
    return db.scalars(query).all()


def get_store_promotion(db: Session, store_id: int, promotion_id: int) -> StorePromotion | None:
    return db.scalar(
        select(StorePromotion)
        .options(*PROMOTION_OPTIONS)
        .where(StorePromotion.store_id == store_id, StorePromotion.id == promotion_id)
    )


def serialize_promotion_items(items: list[StorePromotionItem]) -> list[dict[str, object]]:
    return [
        {
            "id": item.id,
            "product_id": item.product_id,
            "product_name": item.product.name if item.product is not None else f"Producto #{item.product_id}",
            "quantity": item.quantity,
            "sort_order": item.sort_order,
        }
        for item in items
    ]


def deserialize_items_snapshot(items_snapshot_json: str | None) -> list[dict[str, object]]:
    if not items_snapshot_json:
        return []
    try:
        payload = json.loads(items_snapshot_json)
    except json.JSONDecodeError:
        return []
    return payload if isinstance(payload, list) else []


def count_customer_promotion_usage_today(
    db: Session,
    *,
    user_id: int,
    store_id: int,
    promotion_id: int,
) -> int:
    now = datetime.now(UTC)
    start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
    return int(
        db.scalar(
            select(func.coalesce(func.sum(OrderPromotionApplication.combo_count), 0))
            .join(StoreOrder, StoreOrder.id == OrderPromotionApplication.order_id)
            .where(
                OrderPromotionApplication.promotion_id == promotion_id,
                StoreOrder.user_id == user_id,
                StoreOrder.store_id == store_id,
                StoreOrder.created_at >= start_of_day,
                StoreOrder.status != "cancelled",
            )
        )
        or 0
    )


def _cart_item_snapshot(cart: ShoppingCart) -> dict[int, dict[str, object]]:
    return {
        item.product_id: {
            "product_id": item.product_id,
            "product_name": item.product_name_snapshot,
            "quantity": item.quantity,
            "unit_price": float(item.unit_price_snapshot),
        }
        for item in cart.items
    }


def calculate_applied_promotions(db: Session, cart: ShoppingCart) -> list[AppliedPromotionSummary]:
    if cart.store_id is None or not cart.items:
        return []

    promotions = [
        promotion
        for promotion in get_store_promotions(db, cart.store_id, include_inactive=False)
        if promotion.items
    ]
    if not promotions:
        return []

    item_map = _cart_item_snapshot(cart)
    remaining_quantities = {
        product_id: int(item["quantity"])
        for product_id, item in item_map.items()
    }
    usage_today = {
        promotion.id: count_customer_promotion_usage_today(
            db,
            user_id=cart.user_id,
            store_id=cart.store_id,
            promotion_id=promotion.id,
        )
        for promotion in promotions
    }
    applied_in_current_cart: dict[int, int] = {}
    applied_promotions: list[AppliedPromotionSummary] = []

    while True:
        best_candidate: tuple[float, float, int, int, StorePromotion, int] | None = None

        for promotion in promotions:
            remaining_daily_limit = max(
                0,
                int(promotion.max_per_customer_per_day) - usage_today.get(promotion.id, 0) - applied_in_current_cart.get(promotion.id, 0),
            )
            if remaining_daily_limit <= 0:
                continue

            max_combo_count = min(
                (
                    remaining_quantities.get(item.product_id, 0) // int(item.quantity)
                    for item in promotion.items
                ),
                default=0,
            )
            combo_count = min(max_combo_count, remaining_daily_limit)
            if combo_count <= 0:
                continue

            base_total = sum(
                remaining_item["unit_price"] * int(item.quantity)
                for item in promotion.items
                if (remaining_item := item_map.get(item.product_id)) is not None
            )
            discount_total = round(base_total - float(promotion.sale_price), 2)
            if discount_total <= 0:
                continue

            total_savings = round(discount_total * combo_count, 2)
            candidate = (
                total_savings,
                discount_total,
                -int(promotion.sort_order or 0),
                -int(promotion.id),
                promotion,
                combo_count,
            )
            if best_candidate is None or candidate > best_candidate:
                best_candidate = candidate

        if best_candidate is None:
            break

        _, discount_per_combo, _, _, promotion, combo_count = best_candidate
        for item in promotion.items:
            remaining_quantities[item.product_id] = max(
                0,
                remaining_quantities.get(item.product_id, 0) - int(item.quantity) * combo_count,
            )
        applied_in_current_cart[promotion.id] = applied_in_current_cart.get(promotion.id, 0) + combo_count

        base_total = round(
            sum(
                float(item_map[item.product_id]["unit_price"]) * int(item.quantity) * combo_count
                for item in promotion.items
                if item.product_id in item_map
            ),
            2,
        )
        applied_promotions.append(
            AppliedPromotionSummary(
                promotion_id=promotion.id,
                promotion_name=promotion.name,
                combo_count=combo_count,
                sale_price=round(float(promotion.sale_price), 2),
                base_total=base_total,
                discount_total=round(discount_per_combo * combo_count, 2),
                items=serialize_promotion_items(list(promotion.items)),
            )
        )

    return applied_promotions


def applied_promotions_discount_total(applied_promotions: list[AppliedPromotionSummary]) -> float:
    return round(sum(item.discount_total for item in applied_promotions), 2)


def persist_order_promotions(
    db: Session,
    *,
    order: StoreOrder,
    applied_promotions: list[AppliedPromotionSummary],
) -> None:
    for applied in applied_promotions:
        db.add(
            OrderPromotionApplication(
                order_id=order.id,
                promotion_id=applied.promotion_id,
                promotion_name_snapshot=applied.promotion_name,
                sale_price_snapshot=applied.sale_price,
                combo_count=applied.combo_count,
                base_total_snapshot=applied.base_total,
                discount_total_snapshot=applied.discount_total,
                items_snapshot_json=json.dumps(applied.items, ensure_ascii=True),
            )
        )
