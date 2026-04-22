"""user_must_change_password

Revision ID: a1b2c3d4e5f6
Revises: f3c1b8a9d204
Create Date: 2026-03-29 13:30:00.000000
"""

from __future__ import annotations

from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "4a6d8f2c1b30"
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


def upgrade() -> None:
    if not _has_table("users"):
        return

    if not _has_column("users", "must_change_password"):
        op.add_column(
            "users",
            sa.Column("must_change_password", sa.Boolean(), nullable=False, server_default=sa.false()),
        )

    if _has_column("users", "must_change_password"):
        op.execute(sa.text("UPDATE users SET must_change_password = false WHERE must_change_password IS NULL"))
        if op.get_bind().dialect.name != "sqlite":
            op.alter_column("users", "must_change_password", server_default=None)


def downgrade() -> None:
    if not _has_table("users"):
        return

    if _has_column("users", "must_change_password"):
        op.drop_column("users", "must_change_password")
