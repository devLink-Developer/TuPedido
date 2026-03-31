"""platform_branding_assets

Revision ID: d4b7c8e9f112
Revises: c9e6f4a1b2d3
Create Date: 2026-03-31 15:15:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d4b7c8e9f112"
down_revision: Union[str, None] = "c9e6f4a1b2d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _inspector() -> sa.Inspector:
    return sa.inspect(op.get_bind())


def _has_column(table_name: str, column_name: str) -> bool:
    return column_name in {column["name"] for column in _inspector().get_columns(table_name)}


def upgrade() -> None:
    if not _has_column("platform_settings", "platform_logo_url"):
        op.add_column("platform_settings", sa.Column("platform_logo_url", sa.Text(), nullable=True))
    if not _has_column("platform_settings", "platform_favicon_url"):
        op.add_column("platform_settings", sa.Column("platform_favicon_url", sa.Text(), nullable=True))
    if not _has_column("platform_settings", "platform_use_logo_as_favicon"):
        op.add_column(
            "platform_settings",
            sa.Column("platform_use_logo_as_favicon", sa.Boolean(), nullable=False, server_default=sa.false()),
        )
    if op.get_bind().dialect.name != "sqlite":
        op.alter_column("platform_settings", "platform_use_logo_as_favicon", server_default=None)


def downgrade() -> None:
    op.drop_column("platform_settings", "platform_use_logo_as_favicon")
    op.drop_column("platform_settings", "platform_favicon_url")
    op.drop_column("platform_settings", "platform_logo_url")
