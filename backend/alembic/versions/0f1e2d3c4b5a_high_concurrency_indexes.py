"""high_concurrency_indexes

Revision ID: 0f1e2d3c4b5a
Revises: c7a9e2d4b811
Create Date: 2026-05-19 22:30:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0f1e2d3c4b5a"
down_revision: Union[str, Sequence[str], None] = "c7a9e2d4b811"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _inspector() -> sa.Inspector:
    return sa.inspect(op.get_bind())


def _dialect_name() -> str:
    return op.get_bind().dialect.name


def _has_table(table_name: str) -> bool:
    return table_name in _inspector().get_table_names()


def _has_index(table_name: str, index_name: str) -> bool:
    return index_name in {index["name"] for index in _inspector().get_indexes(table_name)}


def _has_unique_constraint(table_name: str, constraint_name: str) -> bool:
    return constraint_name in {
        constraint["name"]
        for constraint in _inspector().get_unique_constraints(table_name)
    }


def _create_index(
    table_name: str,
    index_name: str,
    columns: list[str],
    *,
    postgresql_where: str | None = None,
) -> None:
    if not _has_table(table_name) or _has_index(table_name, index_name):
        return
    kwargs: dict[str, object] = {}
    if _dialect_name() == "postgresql" and postgresql_where:
        kwargs["postgresql_where"] = sa.text(postgresql_where)
    op.create_index(index_name, table_name, columns, **kwargs)


def _drop_index(table_name: str, index_name: str) -> None:
    if _has_table(table_name) and _has_index(table_name, index_name):
        op.drop_index(index_name, table_name=table_name)


def _merge_duplicate_cart_items() -> None:
    if _dialect_name() != "postgresql" or not _has_table("shopping_cart_items"):
        return
    op.execute(
        sa.text(
            """
            WITH ranked AS (
                SELECT
                    id,
                    SUM(quantity) OVER (PARTITION BY cart_id, product_id) AS merged_quantity,
                    ROW_NUMBER() OVER (PARTITION BY cart_id, product_id ORDER BY id ASC) AS row_number
                FROM shopping_cart_items
            )
            UPDATE shopping_cart_items AS item
            SET quantity = ranked.merged_quantity
            FROM ranked
            WHERE item.id = ranked.id AND ranked.row_number = 1
            """
        )
    )
    op.execute(
        sa.text(
            """
            WITH ranked AS (
                SELECT
                    id,
                    ROW_NUMBER() OVER (PARTITION BY cart_id, product_id ORDER BY id ASC) AS row_number
                FROM shopping_cart_items
            )
            DELETE FROM shopping_cart_items AS item
            USING ranked
            WHERE item.id = ranked.id AND ranked.row_number > 1
            """
        )
    )


def upgrade() -> None:
    _merge_duplicate_cart_items()

    if _has_table("shopping_cart_items") and not _has_unique_constraint(
        "shopping_cart_items", "uq_shopping_cart_items_cart_product"
    ):
        op.create_unique_constraint(
            "uq_shopping_cart_items_cart_product",
            "shopping_cart_items",
            ["cart_id", "product_id"],
        )

    _create_index("notification_events", "ix_notification_events_user_created_id", ["user_id", "created_at", "id"])
    _create_index(
        "notification_events",
        "ix_notification_events_queued_created_id",
        ["created_at", "id"],
        postgresql_where="push_status = 'queued'",
    )
    _create_index(
        "push_subscriptions",
        "ix_push_subscriptions_user_active_updated_id",
        ["user_id", "updated_at", "id"],
        postgresql_where="disabled_at IS NULL",
    )
    _create_index("store_orders", "ix_store_orders_user_id_id", ["user_id", "id"])
    _create_index("store_orders", "ix_store_orders_store_id_id", ["store_id", "id"])
    _create_index(
        "store_orders",
        "ix_store_orders_rider_active_lookup",
        ["assigned_rider_id", "delivery_mode", "status", "id"],
    )
    _create_index(
        "store_products",
        "ix_store_products_store_available_sort_id",
        ["store_id", "is_available", "sort_order", "id"],
    )
    _create_index(
        "store_promotions",
        "ix_store_promotions_store_active_sort_id",
        ["store_id", "is_active", "sort_order", "id"],
    )
    _create_index(
        "delivery_profiles",
        "ix_delivery_profiles_active_available_zone_location",
        ["availability", "current_zone_id", "last_location_at"],
        postgresql_where="is_active IS TRUE",
    )
    _create_index(
        "delivery_assignments",
        "ix_delivery_assignments_pending_offer",
        ["offer_expires_at", "id"],
        postgresql_where="status = 'assignment_pending' AND offer_expires_at IS NOT NULL",
    )
    _create_index(
        "delivery_assignments",
        "ix_delivery_assignments_active_heartbeat",
        ["last_heartbeat_at", "id"],
        postgresql_where=(
            "tracking_stale IS FALSE "
            "AND status IN ('assigned', 'heading_to_store', 'picked_up', 'near_customer')"
        ),
    )
    _create_index(
        "payment_transactions",
        "ix_payment_transactions_mp_sync",
        ["updated_at", "id"],
        postgresql_where=(
            "provider = 'mercadopago' "
            "AND payment_id IS NOT NULL "
            "AND status IN ('pending', 'processing', 'paid')"
        ),
    )
    _create_index(
        "merchant_payment_accounts",
        "ix_merchant_payment_accounts_mp_expiring",
        ["token_expires_at", "id"],
        postgresql_where=(
            "provider = 'mercadopago' "
            "AND connected IS TRUE "
            "AND reconnect_required IS FALSE "
            "AND refresh_token_encrypted IS NOT NULL "
            "AND token_expires_at IS NOT NULL"
        ),
    )


def downgrade() -> None:
    for table_name, index_name in (
        ("merchant_payment_accounts", "ix_merchant_payment_accounts_mp_expiring"),
        ("payment_transactions", "ix_payment_transactions_mp_sync"),
        ("delivery_assignments", "ix_delivery_assignments_active_heartbeat"),
        ("delivery_assignments", "ix_delivery_assignments_pending_offer"),
        ("delivery_profiles", "ix_delivery_profiles_active_available_zone_location"),
        ("store_promotions", "ix_store_promotions_store_active_sort_id"),
        ("store_products", "ix_store_products_store_available_sort_id"),
        ("store_orders", "ix_store_orders_rider_active_lookup"),
        ("store_orders", "ix_store_orders_store_id_id"),
        ("store_orders", "ix_store_orders_user_id_id"),
        ("push_subscriptions", "ix_push_subscriptions_user_active_updated_id"),
        ("notification_events", "ix_notification_events_queued_created_id"),
        ("notification_events", "ix_notification_events_user_created_id"),
    ):
        _drop_index(table_name, index_name)

    if _has_table("shopping_cart_items") and _has_unique_constraint(
        "shopping_cart_items", "uq_shopping_cart_items_cart_product"
    ):
        op.drop_constraint(
            "uq_shopping_cart_items_cart_product",
            "shopping_cart_items",
            type_="unique",
        )
