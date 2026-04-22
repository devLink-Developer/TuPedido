"""promotions_and_settlement_receipts

Revision ID: f5a1d7c3e901
Revises: 4a6d8f2c1b30
Create Date: 2026-04-02 11:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f5a1d7c3e901"
down_revision: Union[str, None] = "4a6d8f2c1b30"
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


def _drop_index(table_name: str, columns: list[str]) -> None:
    index_name = op.f(f"ix_{table_name}_{'_'.join(columns)}")
    if _has_table(table_name) and _has_index(table_name, index_name):
        op.drop_index(index_name, table_name=table_name)


def upgrade() -> None:
    is_sqlite = op.get_bind().dialect.name == "sqlite"
    if not _has_table("store_promotions"):
        op.create_table(
            "store_promotions",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("store_id", sa.Integer(), sa.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False),
            sa.Column("name", sa.String(length=180), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("sale_price", sa.Numeric(precision=10, scale=2), nullable=False),
            sa.Column("max_per_customer_per_day", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
        if not is_sqlite:
            op.alter_column("store_promotions", "max_per_customer_per_day", server_default=None)
            op.alter_column("store_promotions", "sort_order", server_default=None)
    _create_index("store_promotions", ["id"])
    _create_index("store_promotions", ["store_id"])
    _create_index("store_promotions", ["is_active"])

    if not _has_table("store_promotion_items"):
        op.create_table(
            "store_promotion_items",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "promotion_id", sa.Integer(), sa.ForeignKey("store_promotions.id", ondelete="CASCADE"), nullable=False
            ),
            sa.Column("product_id", sa.Integer(), sa.ForeignKey("store_products.id", ondelete="CASCADE"), nullable=False),
            sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
            sa.UniqueConstraint("promotion_id", "product_id", name="uq_store_promotion_items_promotion_product"),
        )
        if not is_sqlite:
            op.alter_column("store_promotion_items", "quantity", server_default=None)
            op.alter_column("store_promotion_items", "sort_order", server_default=None)
    _create_index("store_promotion_items", ["id"])
    _create_index("store_promotion_items", ["promotion_id"])
    _create_index("store_promotion_items", ["product_id"])

    if not _has_table("order_promotion_applications"):
        op.create_table(
            "order_promotion_applications",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("order_id", sa.Integer(), sa.ForeignKey("store_orders.id", ondelete="CASCADE"), nullable=False),
            sa.Column(
                "promotion_id", sa.Integer(), sa.ForeignKey("store_promotions.id", ondelete="SET NULL"), nullable=True
            ),
            sa.Column("promotion_name_snapshot", sa.String(length=180), nullable=False),
            sa.Column("sale_price_snapshot", sa.Numeric(precision=10, scale=2), nullable=False),
            sa.Column("combo_count", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("base_total_snapshot", sa.Numeric(precision=10, scale=2), nullable=False),
            sa.Column("discount_total_snapshot", sa.Numeric(precision=10, scale=2), nullable=False),
            sa.Column("items_snapshot_json", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
        if not is_sqlite:
            op.alter_column("order_promotion_applications", "combo_count", server_default=None)
    _create_index("order_promotion_applications", ["id"])
    _create_index("order_promotion_applications", ["order_id"])
    _create_index("order_promotion_applications", ["promotion_id"])

    if _has_table("rider_settlement_payments"):
        if not _has_column("rider_settlement_payments", "receiver_status"):
            op.add_column(
                "rider_settlement_payments",
                sa.Column("receiver_status", sa.String(length=40), nullable=False, server_default="pending_confirmation"),
            )
        if not _has_column("rider_settlement_payments", "receiver_response_notes"):
            op.add_column(
                "rider_settlement_payments",
                sa.Column("receiver_response_notes", sa.Text(), nullable=True),
            )
        if not _has_column("rider_settlement_payments", "receiver_responded_at"):
            op.add_column(
                "rider_settlement_payments",
                sa.Column("receiver_responded_at", sa.DateTime(timezone=True), nullable=True),
            )
        if not is_sqlite:
            op.alter_column("rider_settlement_payments", "receiver_status", server_default=None)
    _create_index("rider_settlement_payments", ["receiver_status"])


def downgrade() -> None:
    _drop_index("rider_settlement_payments", ["receiver_status"])
    if _has_table("rider_settlement_payments") and _has_column("rider_settlement_payments", "receiver_responded_at"):
        op.drop_column("rider_settlement_payments", "receiver_responded_at")
    if _has_table("rider_settlement_payments") and _has_column("rider_settlement_payments", "receiver_response_notes"):
        op.drop_column("rider_settlement_payments", "receiver_response_notes")
    if _has_table("rider_settlement_payments") and _has_column("rider_settlement_payments", "receiver_status"):
        op.drop_column("rider_settlement_payments", "receiver_status")

    for columns in (["promotion_id"], ["order_id"], ["id"]):
        _drop_index("order_promotion_applications", columns)
    if _has_table("order_promotion_applications"):
        op.drop_table("order_promotion_applications")

    for columns in (["product_id"], ["promotion_id"], ["id"]):
        _drop_index("store_promotion_items", columns)
    if _has_table("store_promotion_items"):
        op.drop_table("store_promotion_items")

    for columns in (["is_active"], ["store_id"], ["id"]):
        _drop_index("store_promotions", columns)
    if _has_table("store_promotions"):
        op.drop_table("store_promotions")
