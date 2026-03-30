"""order_reviews_post_delivery

Revision ID: b7c9d1e2f314
Revises: a1b2c3d4e5f6
Create Date: 2026-03-29 23:25:00.000000
"""

from __future__ import annotations

from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "b7c9d1e2f314"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def _has_table(table_name: str) -> bool:
    bind = op.get_bind()
    inspector = inspect(bind)
    return table_name in inspector.get_table_names()


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = inspect(bind)
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def _has_index(table_name: str, index_name: str) -> bool:
    bind = op.get_bind()
    inspector = inspect(bind)
    return any(index["name"] == index_name for index in inspector.get_indexes(table_name))


def _create_index(table_name: str, columns: list[str], *, unique: bool = False) -> None:
    index_name = op.f(f"ix_{table_name}_{'_'.join(columns)}")
    if not _has_index(table_name, index_name):
        op.create_index(index_name, table_name, columns, unique=unique)


def upgrade() -> None:
    if _has_table("store_orders") and not _has_column("store_orders", "review_prompt_enabled"):
        op.add_column(
            "store_orders",
            sa.Column("review_prompt_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        )
        op.execute(sa.text("UPDATE store_orders SET review_prompt_enabled = false WHERE review_prompt_enabled IS NULL"))

    if not _has_table("order_reviews"):
        op.create_table(
            "order_reviews",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("order_id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("store_id", sa.Integer(), nullable=False),
            sa.Column("rider_user_id", sa.Integer(), nullable=True),
            sa.Column("store_rating", sa.Integer(), nullable=False),
            sa.Column("rider_rating", sa.Integer(), nullable=True),
            sa.Column("review_text", sa.Text(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("(CURRENT_TIMESTAMP)"),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("(CURRENT_TIMESTAMP)"),
                nullable=False,
            ),
            sa.CheckConstraint("store_rating >= 1 AND store_rating <= 5", name="ck_order_reviews_store_rating_range"),
            sa.CheckConstraint(
                "rider_rating IS NULL OR (rider_rating >= 1 AND rider_rating <= 5)",
                name="ck_order_reviews_rider_rating_range",
            ),
            sa.ForeignKeyConstraint(["order_id"], ["store_orders.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["rider_user_id"], ["users.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["store_id"], ["stores.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("order_id"),
        )

    _create_index("order_reviews", ["id"])
    _create_index("order_reviews", ["user_id"])
    _create_index("order_reviews", ["store_id"])
    _create_index("order_reviews", ["rider_user_id"])


def downgrade() -> None:
    if _has_table("order_reviews"):
        for columns in (["rider_user_id"], ["store_id"], ["user_id"], ["id"]):
            index_name = op.f(f"ix_order_reviews_{'_'.join(columns)}")
            if _has_index("order_reviews", index_name):
                op.drop_index(index_name, table_name="order_reviews")
        op.drop_table("order_reviews")

    if _has_table("store_orders") and _has_column("store_orders", "review_prompt_enabled"):
        op.drop_column("store_orders", "review_prompt_enabled")
