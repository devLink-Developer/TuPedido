"""merchant_stats_indexes

Revision ID: 9b2d7a6c4f10
Revises: f8c2d6e9a013
Create Date: 2026-05-17 17:40:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9b2d7a6c4f10"
down_revision: Union[str, Sequence[str], None] = "f8c2d6e9a013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _inspector() -> sa.Inspector:
    return sa.inspect(op.get_bind())


def _has_table(table_name: str) -> bool:
    return table_name in _inspector().get_table_names()


def _has_index(table_name: str, index_name: str) -> bool:
    return index_name in {index["name"] for index in _inspector().get_indexes(table_name)}


def _create_index(table_name: str, index_name: str, columns: list[str]) -> None:
    if _has_table(table_name) and not _has_index(table_name, index_name):
        op.create_index(index_name, table_name, columns)


def _drop_index(table_name: str, index_name: str) -> None:
    if _has_table(table_name) and _has_index(table_name, index_name):
        op.drop_index(index_name, table_name=table_name)


def upgrade() -> None:
    _create_index("store_orders", "ix_store_orders_store_created_at", ["store_id", "created_at"])
    _create_index("store_orders", "ix_store_orders_store_status_created_at", ["store_id", "status", "created_at"])
    _create_index("store_orders", "ix_store_orders_store_user_created_at", ["store_id", "user_id", "created_at"])
    _create_index("store_order_items", "ix_store_order_items_product_order", ["product_id", "order_id"])


def downgrade() -> None:
    _drop_index("store_order_items", "ix_store_order_items_product_order")
    _drop_index("store_orders", "ix_store_orders_store_user_created_at")
    _drop_index("store_orders", "ix_store_orders_store_status_created_at")
    _drop_index("store_orders", "ix_store_orders_store_created_at")
