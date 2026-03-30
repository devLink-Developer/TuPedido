from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.delivery import DeliveryProfile
from app.models.order import OrderReview, StoreOrder
from app.models.store import Store


def normalize_review_text(value: str | None) -> str | None:
    if value is None:
        return None

    normalized = value.strip()
    return normalized or None


def requires_rider_rating(order: StoreOrder) -> bool:
    return order.assigned_rider_id is not None


def find_oldest_pending_review_order(db: Session, *, user_id: int) -> StoreOrder | None:
    return db.scalar(
        select(StoreOrder)
        .outerjoin(OrderReview, OrderReview.order_id == StoreOrder.id)
        .where(
            StoreOrder.user_id == user_id,
            StoreOrder.status == "delivered",
            StoreOrder.review_prompt_enabled.is_(True),
            OrderReview.id.is_(None),
        )
        .order_by(func.coalesce(StoreOrder.delivered_at, StoreOrder.created_at).asc(), StoreOrder.id.asc())
        .limit(1)
    )


def recalculate_store_rating(db: Session, *, store_id: int) -> None:
    store = db.get(Store, store_id)
    if store is None:
        return

    rating_count, average_rating = db.execute(
        select(func.count(OrderReview.id), func.avg(OrderReview.store_rating)).where(OrderReview.store_id == store_id)
    ).one()
    store.rating_count = int(rating_count or 0)
    store.rating = float(average_rating or 0)


def recalculate_rider_rating(db: Session, *, rider_user_id: int) -> None:
    profile = db.get(DeliveryProfile, rider_user_id)
    if profile is None:
        return

    _, average_rating = db.execute(
        select(func.count(OrderReview.id), func.avg(OrderReview.rider_rating)).where(
            OrderReview.rider_user_id == rider_user_id,
            OrderReview.rider_rating.is_not(None),
        )
    ).one()
    profile.rating = float(average_rating or 0)
