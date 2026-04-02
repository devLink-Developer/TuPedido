"""merge_current_heads

Revision ID: c1f8e6a4b9d2
Revises: f5a1d7c3e901, a8d4e7c2b951, e1a4c2b8d9f0
Create Date: 2026-04-02 15:20:00.000000
"""

from typing import Sequence, Union


revision: str = "c1f8e6a4b9d2"
down_revision: Union[str, Sequence[str], None] = (
    "f5a1d7c3e901",
    "a8d4e7c2b951",
    "e1a4c2b8d9f0",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
