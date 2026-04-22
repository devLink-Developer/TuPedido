"""product_media_pricing_v2

Revision ID: 8c2f9a6b1d44
Revises: 7b6f8c4d2a10
Create Date: 2026-03-25 08:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "8c2f9a6b1d44"
down_revision: Union[str, None] = "7b6f8c4d2a10"
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


def _create_index(table_name: str, columns: list[str], *, unique: bool = False) -> None:
    index_name = op.f(f"ix_{table_name}_{'_'.join(columns)}")
    if _has_table(table_name) and not _has_index(table_name, index_name):
        op.create_index(index_name, table_name, columns, unique=unique)


def upgrade() -> None:
    if _has_table("store_products"):
        if not _has_column("store_products", "sku"):
            op.add_column("store_products", sa.Column("sku", sa.String(length=80), nullable=True))
        if not _has_column("store_products", "brand"):
            op.add_column("store_products", sa.Column("brand", sa.String(length=120), nullable=True))
        if not _has_column("store_products", "barcode"):
            op.add_column("store_products", sa.Column("barcode", sa.String(length=80), nullable=True))
        if not _has_column("store_products", "unit_label"):
            op.add_column("store_products", sa.Column("unit_label", sa.String(length=60), nullable=True))
        if not _has_column("store_products", "commercial_discount_type"):
            op.add_column("store_products", sa.Column("commercial_discount_type", sa.String(length=20), nullable=True))
        if not _has_column("store_products", "commercial_discount_value"):
            op.add_column("store_products", sa.Column("commercial_discount_value", sa.Numeric(precision=10, scale=2), nullable=True))
        if not _has_column("store_products", "stock_quantity"):
            op.add_column("store_products", sa.Column("stock_quantity", sa.Integer(), nullable=True))
        if not _has_column("store_products", "max_per_order"):
            op.add_column("store_products", sa.Column("max_per_order", sa.Integer(), nullable=True))
        op.execute(sa.text("UPDATE store_products SET sku = COALESCE(NULLIF(sku, ''), 'PRD-' || id)"))
    _create_index("store_products", ["sku"])

    if _has_table("shopping_carts"):
        if not _has_column("shopping_carts", "commercial_discount_total"):
            op.add_column(
                "shopping_carts",
                sa.Column("commercial_discount_total", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0"),
            )
        if not _has_column("shopping_carts", "financial_discount_total"):
            op.add_column(
                "shopping_carts",
                sa.Column("financial_discount_total", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0"),
            )

    if _has_table("shopping_cart_items"):
        if not _has_column("shopping_cart_items", "base_unit_price_snapshot"):
            op.add_column(
                "shopping_cart_items",
                sa.Column("base_unit_price_snapshot", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0"),
            )
        if not _has_column("shopping_cart_items", "commercial_discount_amount_snapshot"):
            op.add_column(
                "shopping_cart_items",
                sa.Column(
                    "commercial_discount_amount_snapshot",
                    sa.Numeric(precision=10, scale=2),
                    nullable=False,
                    server_default="0",
                ),
            )
        op.execute(
            sa.text(
                """
                UPDATE shopping_cart_items
                SET base_unit_price_snapshot = unit_price_snapshot
                WHERE COALESCE(base_unit_price_snapshot, 0) = 0
                """
            )
        )

    if _has_table("store_orders"):
        if not _has_column("store_orders", "commercial_discount_total"):
            op.add_column(
                "store_orders",
                sa.Column("commercial_discount_total", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0"),
            )
        if not _has_column("store_orders", "financial_discount_total"):
            op.add_column(
                "store_orders",
                sa.Column("financial_discount_total", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0"),
            )

    if _has_table("store_order_items"):
        if not _has_column("store_order_items", "base_unit_price_snapshot"):
            op.add_column(
                "store_order_items",
                sa.Column("base_unit_price_snapshot", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0"),
            )
        if not _has_column("store_order_items", "commercial_discount_amount_snapshot"):
            op.add_column(
                "store_order_items",
                sa.Column(
                    "commercial_discount_amount_snapshot",
                    sa.Numeric(precision=10, scale=2),
                    nullable=False,
                    server_default="0",
                ),
            )
        op.execute(
            sa.text(
                """
                UPDATE store_order_items
                SET base_unit_price_snapshot = unit_price_snapshot
                WHERE COALESCE(base_unit_price_snapshot, 0) = 0
                """
            )
        )

    if op.get_bind().dialect.name != "sqlite":
        for table_name, column_name in (
            ("shopping_carts", "commercial_discount_total"),
            ("shopping_carts", "financial_discount_total"),
            ("shopping_cart_items", "base_unit_price_snapshot"),
            ("shopping_cart_items", "commercial_discount_amount_snapshot"),
            ("store_orders", "commercial_discount_total"),
            ("store_orders", "financial_discount_total"),
            ("store_order_items", "base_unit_price_snapshot"),
            ("store_order_items", "commercial_discount_amount_snapshot"),
        ):
            if _has_table(table_name) and _has_column(table_name, column_name):
                op.alter_column(table_name, column_name, server_default=None)


def downgrade() -> None:
    if _has_table("store_order_items") and _has_column("store_order_items", "commercial_discount_amount_snapshot"):
        op.drop_column("store_order_items", "commercial_discount_amount_snapshot")
    if _has_table("store_order_items") and _has_column("store_order_items", "base_unit_price_snapshot"):
        op.drop_column("store_order_items", "base_unit_price_snapshot")

    if _has_table("store_orders") and _has_column("store_orders", "financial_discount_total"):
        op.drop_column("store_orders", "financial_discount_total")
    if _has_table("store_orders") and _has_column("store_orders", "commercial_discount_total"):
        op.drop_column("store_orders", "commercial_discount_total")

    if _has_table("shopping_cart_items") and _has_column("shopping_cart_items", "commercial_discount_amount_snapshot"):
        op.drop_column("shopping_cart_items", "commercial_discount_amount_snapshot")
    if _has_table("shopping_cart_items") and _has_column("shopping_cart_items", "base_unit_price_snapshot"):
        op.drop_column("shopping_cart_items", "base_unit_price_snapshot")

    if _has_table("shopping_carts") and _has_column("shopping_carts", "financial_discount_total"):
        op.drop_column("shopping_carts", "financial_discount_total")
    if _has_table("shopping_carts") and _has_column("shopping_carts", "commercial_discount_total"):
        op.drop_column("shopping_carts", "commercial_discount_total")

    if _has_table("store_products") and _has_index("store_products", op.f("ix_store_products_sku")):
        op.drop_index(op.f("ix_store_products_sku"), table_name="store_products")
    for column_name in (
        "max_per_order",
        "stock_quantity",
        "commercial_discount_value",
        "commercial_discount_type",
        "unit_label",
        "barcode",
        "brand",
        "sku",
    ):
        if _has_table("store_products") and _has_column("store_products", column_name):
            op.drop_column("store_products", column_name)
