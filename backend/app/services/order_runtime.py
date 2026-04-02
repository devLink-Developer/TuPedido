from __future__ import annotations

from sqlalchemy.orm import Session, selectinload

from app.models.order import StoreOrder
from app.services.platform import get_table_columns

ORDER_PROMOTION_APPLICATION_COLUMNS = {
    "id",
    "order_id",
    "promotion_id",
    "promotion_name_snapshot",
    "sale_price_snapshot",
    "combo_count",
    "base_total_snapshot",
    "discount_total_snapshot",
    "items_snapshot_json",
    "created_at",
}


def has_order_promotion_schema(db: Session | None) -> bool:
    if db is None:
        return False
    columns = get_table_columns(db, "order_promotion_applications")
    return ORDER_PROMOTION_APPLICATION_COLUMNS.issubset(columns)


def build_order_options(db: Session, *base_options: object) -> tuple[object, ...]:
    if has_order_promotion_schema(db):
        return (*base_options, selectinload(StoreOrder.promotion_applications))
    return tuple(base_options)
