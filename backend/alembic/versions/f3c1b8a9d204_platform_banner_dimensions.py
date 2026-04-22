"""platform_banner_dimensions

Revision ID: f3c1b8a9d204
Revises: e1a4c7d9f201
Create Date: 2026-03-25 23:05:00.000000
"""

from __future__ import annotations

from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "f3c1b8a9d204"
down_revision: Union[str, None] = "e1a4c7d9f201"
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

    if not _has_column("platform_settings", "catalog_banner_width"):
        op.add_column(
            "platform_settings",
            sa.Column("catalog_banner_width", sa.Integer(), nullable=False, server_default="1600"),
        )

    if not _has_column("platform_settings", "catalog_banner_height"):
        op.add_column(
            "platform_settings",
            sa.Column("catalog_banner_height", sa.Integer(), nullable=False, server_default="520"),
        )

    if _has_column("platform_settings", "catalog_banner_width"):
        op.execute(sa.text("UPDATE platform_settings SET catalog_banner_width = 1600 WHERE catalog_banner_width IS NULL"))
        if op.get_bind().dialect.name != "sqlite":
            op.alter_column("platform_settings", "catalog_banner_width", server_default=None)

    if _has_column("platform_settings", "catalog_banner_height"):
        op.execute(sa.text("UPDATE platform_settings SET catalog_banner_height = 520 WHERE catalog_banner_height IS NULL"))
        if op.get_bind().dialect.name != "sqlite":
            op.alter_column("platform_settings", "catalog_banner_height", server_default=None)


def downgrade() -> None:
    if not _has_table("platform_settings"):
        return

    if _has_column("platform_settings", "catalog_banner_height"):
        op.drop_column("platform_settings", "catalog_banner_height")

    if _has_column("platform_settings", "catalog_banner_width"):
        op.drop_column("platform_settings", "catalog_banner_width")
