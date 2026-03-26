"""store_postal_fields

Revision ID: c4e8f1a2b903
Revises: a5d9c8b7e341
Create Date: 2026-03-26 00:40:00.000000
"""

from __future__ import annotations

from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "c4e8f1a2b903"
down_revision: Union[str, None] = "a5d9c8b7e341"
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
    if not _has_table("stores"):
        return

    if not _has_column("stores", "postal_code"):
        op.add_column("stores", sa.Column("postal_code", sa.String(length=20), nullable=True))

    if not _has_column("stores", "province"):
        op.add_column("stores", sa.Column("province", sa.String(length=120), nullable=True))

    if not _has_column("stores", "locality"):
        op.add_column("stores", sa.Column("locality", sa.String(length=120), nullable=True))


def downgrade() -> None:
    if not _has_table("stores"):
        return

    if _has_column("stores", "locality"):
        op.drop_column("stores", "locality")

    if _has_column("stores", "province"):
        op.drop_column("stores", "province")

    if _has_column("stores", "postal_code"):
        op.drop_column("stores", "postal_code")
