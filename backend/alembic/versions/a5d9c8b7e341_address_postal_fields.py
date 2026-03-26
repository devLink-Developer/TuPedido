"""address_postal_fields

Revision ID: a5d9c8b7e341
Revises: f3c1b8a9d204
Create Date: 2026-03-25 23:55:00.000000
"""

from __future__ import annotations

from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "a5d9c8b7e341"
down_revision: Union[str, None] = "f3c1b8a9d204"
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
    if not _has_table("addresses"):
        return

    if not _has_column("addresses", "postal_code"):
        op.add_column("addresses", sa.Column("postal_code", sa.String(length=20), nullable=True))

    if not _has_column("addresses", "province"):
        op.add_column("addresses", sa.Column("province", sa.String(length=120), nullable=True))

    if not _has_column("addresses", "locality"):
        op.add_column("addresses", sa.Column("locality", sa.String(length=120), nullable=True))


def downgrade() -> None:
    if not _has_table("addresses"):
        return

    if _has_column("addresses", "locality"):
        op.drop_column("addresses", "locality")

    if _has_column("addresses", "province"):
        op.drop_column("addresses", "province")

    if _has_column("addresses", "postal_code"):
        op.drop_column("addresses", "postal_code")
