"""store_delivery_polygons

Revision ID: b3f2a4c6d8e9
Revises: 8f2d6c9a4b11
Create Date: 2026-05-11 12:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b3f2a4c6d8e9"
down_revision: Union[str, Sequence[str], None] = "8f2d6c9a4b11"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _inspector() -> sa.Inspector:
    return sa.inspect(op.get_bind())


def _has_table(table_name: str) -> bool:
    return table_name in _inspector().get_table_names()


def _has_column(table_name: str, column_name: str) -> bool:
    return column_name in {column["name"] for column in _inspector().get_columns(table_name)}


def upgrade() -> None:
    if not _has_table("store_delivery_settings"):
        return

    if not _has_column("store_delivery_settings", "delivery_area_polygon_json"):
        op.add_column("store_delivery_settings", sa.Column("delivery_area_polygon_json", sa.Text(), nullable=True))
    if not _has_column("store_delivery_settings", "pickup_area_polygon_json"):
        op.add_column("store_delivery_settings", sa.Column("pickup_area_polygon_json", sa.Text(), nullable=True))
    if not _has_column("store_delivery_settings", "pickup_area_uses_delivery_area"):
        op.add_column(
            "store_delivery_settings",
            sa.Column("pickup_area_uses_delivery_area", sa.Boolean(), nullable=False, server_default=sa.false()),
        )
        if op.get_bind().dialect.name != "sqlite":
            op.alter_column("store_delivery_settings", "pickup_area_uses_delivery_area", server_default=None)

    if _has_table("stores"):
        op.execute(
            sa.text(
                """
                UPDATE stores
                SET accepting_orders = false
                WHERE id IN (
                    SELECT stores.id
                    FROM stores
                    LEFT JOIN store_delivery_settings settings ON settings.store_id = stores.id
                    WHERE settings.store_id IS NULL
                       OR (
                            settings.delivery_area_polygon_json IS NULL
                            AND settings.pickup_area_polygon_json IS NULL
                            AND COALESCE(settings.pickup_area_uses_delivery_area, false) = false
                       )
                )
                """
            )
        )


def downgrade() -> None:
    if not _has_table("store_delivery_settings"):
        return

    if _has_column("store_delivery_settings", "pickup_area_uses_delivery_area"):
        op.drop_column("store_delivery_settings", "pickup_area_uses_delivery_area")
    if _has_column("store_delivery_settings", "pickup_area_polygon_json"):
        op.drop_column("store_delivery_settings", "pickup_area_polygon_json")
    if _has_column("store_delivery_settings", "delivery_area_polygon_json"):
        op.drop_column("store_delivery_settings", "delivery_area_polygon_json")
