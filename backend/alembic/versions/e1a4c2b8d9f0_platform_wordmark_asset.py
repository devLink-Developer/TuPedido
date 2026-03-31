"""platform_wordmark_asset

Revision ID: e1a4c2b8d9f0
Revises: d4b7c8e9f112
Create Date: 2026-03-31 16:45:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e1a4c2b8d9f0"
down_revision: Union[str, None] = "d4b7c8e9f112"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _inspector() -> sa.Inspector:
    return sa.inspect(op.get_bind())


def _has_column(table_name: str, column_name: str) -> bool:
    return column_name in {column["name"] for column in _inspector().get_columns(table_name)}


def upgrade() -> None:
    if not _has_column("platform_settings", "platform_wordmark_url"):
        op.add_column("platform_settings", sa.Column("platform_wordmark_url", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("platform_settings", "platform_wordmark_url")
