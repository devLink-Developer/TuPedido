"""platform_catalog_banner

Revision ID: e1a4c7d9f201
Revises: b2c4d6e8f101
Create Date: 2026-03-25 19:20:00.000000
"""

from __future__ import annotations

from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = "e1a4c7d9f201"
down_revision: Union[str, None] = "b2c4d6e8f101"
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
    if not _has_table("platform_settings"):
        return
    if not _has_column("platform_settings", "catalog_banner_image_url"):
        op.add_column("platform_settings", sa.Column("catalog_banner_image_url", sa.Text(), nullable=True))


def downgrade() -> None:
    if not _has_table("platform_settings"):
        return
    if _has_column("platform_settings", "catalog_banner_image_url"):
        op.drop_column("platform_settings", "catalog_banner_image_url")
