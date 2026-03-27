"""transfer_notice_proofs

Revision ID: a8d4e7c2b951
Revises: c4e8f1a2b903
Create Date: 2026-03-26 11:20:00.000000
"""

from __future__ import annotations

from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "a8d4e7c2b951"
down_revision: Union[str, None] = "c4e8f1a2b903"
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
    if not _has_table("merchant_transfer_notices"):
        return

    if not _has_column("merchant_transfer_notices", "proof_url"):
        op.add_column("merchant_transfer_notices", sa.Column("proof_url", sa.Text(), nullable=True))
    if not _has_column("merchant_transfer_notices", "proof_content_type"):
        op.add_column("merchant_transfer_notices", sa.Column("proof_content_type", sa.String(length=120), nullable=True))
    if not _has_column("merchant_transfer_notices", "proof_original_name"):
        op.add_column("merchant_transfer_notices", sa.Column("proof_original_name", sa.String(length=255), nullable=True))


def downgrade() -> None:
    if not _has_table("merchant_transfer_notices"):
        return

    if _has_column("merchant_transfer_notices", "proof_original_name"):
        op.drop_column("merchant_transfer_notices", "proof_original_name")
    if _has_column("merchant_transfer_notices", "proof_content_type"):
        op.drop_column("merchant_transfer_notices", "proof_content_type")
    if _has_column("merchant_transfer_notices", "proof_url"):
        op.drop_column("merchant_transfer_notices", "proof_url")
