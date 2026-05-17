"""promotion_product_category_scope

Revision ID: c7a9e2d4b811
Revises: 9b2d7a6c4f10
Create Date: 2026-05-17 19:35:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c7a9e2d4b811"
down_revision: Union[str, Sequence[str], None] = "9b2d7a6c4f10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _inspector() -> sa.Inspector:
    return sa.inspect(op.get_bind())


def _has_table(table_name: str) -> bool:
    return table_name in _inspector().get_table_names()


def _has_column(table_name: str, column_name: str) -> bool:
    return column_name in {column["name"] for column in _inspector().get_columns(table_name)}


def _has_index(table_name: str, index_name: str) -> bool:
    return index_name in {index["name"] for index in _inspector().get_indexes(table_name)}


def _create_index(table_name: str, index_name: str, columns: list[str]) -> None:
    if _has_table(table_name) and not _has_index(table_name, index_name):
        op.create_index(index_name, table_name, columns)


def _drop_index(table_name: str, index_name: str) -> None:
    if _has_table(table_name) and _has_index(table_name, index_name):
        op.drop_index(index_name, table_name=table_name)


def _backfill_single_category_promotions() -> None:
    connection = op.get_bind()
    rows = connection.execute(
        sa.text(
            """
            SELECT spi.promotion_id, MIN(sp.product_category_id) AS product_category_id
            FROM store_promotion_items spi
            JOIN store_products sp ON sp.id = spi.product_id
            WHERE sp.product_category_id IS NOT NULL
            GROUP BY spi.promotion_id
            HAVING COUNT(DISTINCT sp.product_category_id) = 1
            """
        )
    ).mappings()
    for row in rows:
        connection.execute(
            sa.text(
                """
                UPDATE store_promotions
                SET product_category_id = :product_category_id
                WHERE id = :promotion_id AND product_category_id IS NULL
                """
            ),
            {
                "product_category_id": row["product_category_id"],
                "promotion_id": row["promotion_id"],
            },
        )


def upgrade() -> None:
    if not _has_table("store_promotions"):
        return

    if not _has_column("store_promotions", "product_category_id"):
        if op.get_bind().dialect.name == "sqlite":
            op.add_column("store_promotions", sa.Column("product_category_id", sa.Integer(), nullable=True))
        else:
            op.add_column(
                "store_promotions",
                sa.Column(
                    "product_category_id",
                    sa.Integer(),
                    sa.ForeignKey("product_categories.id", ondelete="SET NULL"),
                    nullable=True,
                ),
            )

    _create_index("store_promotions", "ix_store_promotions_product_category_id", ["product_category_id"])

    if _has_table("store_promotion_items") and _has_table("store_products"):
        _backfill_single_category_promotions()


def downgrade() -> None:
    if not _has_table("store_promotions"):
        return

    _drop_index("store_promotions", "ix_store_promotions_product_category_id")
    if _has_column("store_promotions", "product_category_id"):
        op.drop_column("store_promotions", "product_category_id")
