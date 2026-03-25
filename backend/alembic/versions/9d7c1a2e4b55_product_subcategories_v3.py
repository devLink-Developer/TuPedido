"""product_subcategories_v3

Revision ID: 9d7c1a2e4b55
Revises: 8c2f9a6b1d44
Create Date: 2026-03-25 10:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9d7c1a2e4b55"
down_revision: Union[str, None] = "8c2f9a6b1d44"
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


def upgrade() -> None:
    if not _has_table("product_subcategories"):
        op.create_table(
            "product_subcategories",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "product_category_id",
                sa.Integer(),
                sa.ForeignKey("product_categories.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("name", sa.String(length=120), nullable=False),
            sa.Column("slug", sa.String(length=120), nullable=False),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        )
    if not _has_index("product_subcategories", op.f("ix_product_subcategories_product_category_id")):
        op.create_index(
            op.f("ix_product_subcategories_product_category_id"),
            "product_subcategories",
            ["product_category_id"],
            unique=False,
        )
    if not _has_index("product_subcategories", op.f("ix_product_subcategories_slug")):
        op.create_index(op.f("ix_product_subcategories_slug"), "product_subcategories", ["slug"], unique=False)

    if _has_table("store_products") and not _has_column("store_products", "product_subcategory_id"):
        op.add_column(
            "store_products",
            sa.Column(
                "product_subcategory_id",
                sa.Integer(),
                sa.ForeignKey("product_subcategories.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )
    if _has_table("store_products") and not _has_index("store_products", op.f("ix_store_products_product_subcategory_id")):
        op.create_index(
            op.f("ix_store_products_product_subcategory_id"),
            "store_products",
            ["product_subcategory_id"],
            unique=False,
        )

    if _has_table("product_subcategories") and _has_column("product_subcategories", "sort_order"):
        op.alter_column("product_subcategories", "sort_order", server_default=None)


def downgrade() -> None:
    if _has_table("store_products") and _has_index("store_products", op.f("ix_store_products_product_subcategory_id")):
        op.drop_index(op.f("ix_store_products_product_subcategory_id"), table_name="store_products")
    if _has_table("store_products") and _has_column("store_products", "product_subcategory_id"):
        op.drop_column("store_products", "product_subcategory_id")

    if _has_table("product_subcategories") and _has_index("product_subcategories", op.f("ix_product_subcategories_slug")):
        op.drop_index(op.f("ix_product_subcategories_slug"), table_name="product_subcategories")
    if _has_table("product_subcategories") and _has_index(
        "product_subcategories", op.f("ix_product_subcategories_product_category_id")
    ):
        op.drop_index(op.f("ix_product_subcategories_product_category_id"), table_name="product_subcategories")
    if _has_table("product_subcategories"):
        op.drop_table("product_subcategories")
