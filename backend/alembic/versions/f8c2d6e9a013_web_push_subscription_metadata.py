"""web_push_subscription_metadata

Revision ID: f8c2d6e9a013
Revises: b3f2a4c6d8e9
Create Date: 2026-05-14 12:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f8c2d6e9a013"
down_revision: Union[str, Sequence[str], None] = "b3f2a4c6d8e9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _inspector() -> sa.Inspector:
    return sa.inspect(op.get_bind())


def _has_table(table_name: str) -> bool:
    return table_name in _inspector().get_table_names()


def _has_column(table_name: str, column_name: str) -> bool:
    return column_name in {column["name"] for column in _inspector().get_columns(table_name)}


def _has_index(table_name: str, index_name: str) -> bool:
    return index_name in {index["name"] for index in _inspector().get_indexes(table_name)}


def _create_index(table_name: str, columns: list[str]) -> None:
    index_name = op.f(f"ix_{table_name}_{'_'.join(columns)}")
    if not _has_index(table_name, index_name):
        op.create_index(index_name, table_name, columns)


def upgrade() -> None:
    if not _has_table("push_subscriptions"):
        return

    if not _has_column("push_subscriptions", "push_provider"):
        op.add_column(
            "push_subscriptions",
            sa.Column("push_provider", sa.String(length=40), nullable=False, server_default="web"),
        )
    if not _has_column("push_subscriptions", "platform"):
        op.add_column("push_subscriptions", sa.Column("platform", sa.String(length=80), nullable=True))
    if not _has_column("push_subscriptions", "disabled_at"):
        op.add_column("push_subscriptions", sa.Column("disabled_at", sa.DateTime(timezone=True), nullable=True))
    if not _has_column("push_subscriptions", "last_success_at"):
        op.add_column("push_subscriptions", sa.Column("last_success_at", sa.DateTime(timezone=True), nullable=True))
    if not _has_column("push_subscriptions", "last_attempted_at"):
        op.add_column("push_subscriptions", sa.Column("last_attempted_at", sa.DateTime(timezone=True), nullable=True))
    if not _has_column("push_subscriptions", "last_failure_at"):
        op.add_column("push_subscriptions", sa.Column("last_failure_at", sa.DateTime(timezone=True), nullable=True))
    if not _has_column("push_subscriptions", "last_failure_status"):
        op.add_column("push_subscriptions", sa.Column("last_failure_status", sa.Integer(), nullable=True))
    if not _has_column("push_subscriptions", "failure_count"):
        op.add_column(
            "push_subscriptions",
            sa.Column("failure_count", sa.Integer(), nullable=False, server_default="0"),
        )
    if not _has_column("push_subscriptions", "last_error"):
        op.add_column("push_subscriptions", sa.Column("last_error", sa.Text(), nullable=True))

    subscriptions = sa.sql.table(
        "push_subscriptions",
        sa.column("endpoint", sa.Text()),
        sa.column("push_provider", sa.String()),
        sa.column("platform", sa.String()),
    )
    op.execute(
        subscriptions.update()
        .where(
            sa.or_(
                subscriptions.c.endpoint.like("ExponentPushToken[%"),
                subscriptions.c.endpoint.like("ExpoPushToken[%"),
            )
        )
        .values(push_provider="expo", platform=sa.func.coalesce(subscriptions.c.platform, "android"))
    )

    _create_index("push_subscriptions", ["push_provider"])
    _create_index("push_subscriptions", ["disabled_at"])

    if op.get_bind().dialect.name != "sqlite":
        op.alter_column("push_subscriptions", "push_provider", server_default=None)
        op.alter_column("push_subscriptions", "failure_count", server_default=None)


def downgrade() -> None:
    if not _has_table("push_subscriptions"):
        return

    if _has_index("push_subscriptions", op.f("ix_push_subscriptions_disabled_at")):
        op.drop_index(op.f("ix_push_subscriptions_disabled_at"), table_name="push_subscriptions")
    if _has_index("push_subscriptions", op.f("ix_push_subscriptions_push_provider")):
        op.drop_index(op.f("ix_push_subscriptions_push_provider"), table_name="push_subscriptions")

    for column_name in (
        "last_error",
        "failure_count",
        "last_failure_status",
        "last_failure_at",
        "last_attempted_at",
        "last_success_at",
        "disabled_at",
        "platform",
        "push_provider",
    ):
        if _has_column("push_subscriptions", column_name):
            op.drop_column("push_subscriptions", column_name)
