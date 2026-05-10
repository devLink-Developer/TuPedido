"""mp_marketplace_card_brick

Revision ID: 8f2d6c9a4b11
Revises: e6b8f9c1d204
Create Date: 2026-05-10 12:00:00.000000
"""

from __future__ import annotations

import os
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "8f2d6c9a4b11"
down_revision: Union[str, Sequence[str], None] = "e6b8f9c1d204"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _inspector() -> sa.Inspector:
    return sa.inspect(op.get_bind())


def _has_table(table_name: str) -> bool:
    return table_name in _inspector().get_table_names()


def _has_column(table_name: str, column_name: str) -> bool:
    return _has_table(table_name) and column_name in {column["name"] for column in _inspector().get_columns(table_name)}


def _has_index(table_name: str, index_name: str) -> bool:
    return _has_table(table_name) and index_name in {index["name"] for index in _inspector().get_indexes(table_name)}


def _add_column(table_name: str, column: sa.Column) -> None:
    if _has_table(table_name) and not _has_column(table_name, column.name):
        op.add_column(table_name, column)


def _create_index(table_name: str, columns: list[str]) -> None:
    index_name = op.f(f"ix_{table_name}_{'_'.join(columns)}")
    if _has_table(table_name) and not _has_index(table_name, index_name):
        op.create_index(index_name, table_name, columns)


def _ensure_provider_columns() -> None:
    _add_column("payment_providers", sa.Column("public_key", sa.String(length=255), nullable=True))
    _add_column("payment_providers", sa.Column("commission_mode", sa.String(length=20), nullable=False, server_default="fixed"))
    _add_column("payment_providers", sa.Column("commission_value", sa.Numeric(precision=10, scale=2), nullable=True))
    public_key = (os.getenv("MERCADOPAGO_PUBLIC_KEY") or "").strip()
    if public_key and _has_column("payment_providers", "public_key"):
        op.execute(
            sa.text(
                """
                UPDATE payment_providers
                SET public_key = :public_key
                WHERE provider = 'mercadopago'
                    AND (public_key IS NULL OR public_key = '')
                """
            ).bindparams(public_key=public_key)
        )
    if _has_column("payment_providers", "commission_mode"):
        op.execute(
            sa.text(
                """
                UPDATE payment_providers
                SET commission_mode = COALESCE(NULLIF(commission_mode, ''), 'fixed')
                WHERE provider = 'mercadopago'
                """
            )
        )
        if op.get_bind().dialect.name != "sqlite":
            op.alter_column("payment_providers", "commission_mode", server_default=None)


def _ensure_account_columns() -> None:
    _add_column("merchant_payment_accounts", sa.Column("status", sa.String(length=40), nullable=False, server_default="pending"))
    _add_column("merchant_payment_accounts", sa.Column("last_refresh_at", sa.DateTime(timezone=True), nullable=True))
    _add_column("merchant_payment_accounts", sa.Column("last_refresh_error", sa.Text(), nullable=True))
    _add_column("merchant_payment_accounts", sa.Column("last_oauth_error", sa.Text(), nullable=True))
    if _has_column("merchant_payment_accounts", "status"):
        op.execute(
            sa.text(
                """
                UPDATE merchant_payment_accounts
                SET status = CASE
                    WHEN reconnect_required = true THEN 'expired'
                    WHEN connected = true THEN 'active'
                    ELSE 'pending'
                END
                WHERE provider = 'mercadopago'
                """
            )
        )
        if op.get_bind().dialect.name != "sqlite":
            op.alter_column("merchant_payment_accounts", "status", server_default=None)
    _create_index("merchant_payment_accounts", ["status"])


def _ensure_transaction_columns() -> None:
    _add_column("payment_transactions", sa.Column("payment_session_token", sa.Text(), nullable=True))
    _add_column("payment_transactions", sa.Column("payment_session_expires_at", sa.DateTime(timezone=True), nullable=True))
    _add_column("payment_transactions", sa.Column("provider_status", sa.String(length=60), nullable=True))
    _add_column("payment_transactions", sa.Column("gross_amount", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0"))
    _add_column("payment_transactions", sa.Column("marketplace_fee", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0"))
    _add_column("payment_transactions", sa.Column("net_amount", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0"))
    _add_column("payment_transactions", sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True))
    _add_column("payment_transactions", sa.Column("last_error", sa.Text(), nullable=True))
    _add_column("payment_transactions", sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"))
    if _has_table("payment_transactions"):
        op.execute(
            sa.text(
                """
                UPDATE payment_transactions
                SET gross_amount = CASE WHEN gross_amount = 0 THEN amount_total ELSE gross_amount END,
                    marketplace_fee = CASE
                        WHEN marketplace_fee = 0 THEN COALESCE(requested_marketplace_fee, service_fee_amount, 0)
                        ELSE marketplace_fee
                    END,
                    net_amount = CASE
                        WHEN net_amount = 0 THEN COALESCE(amount_total, 0) - COALESCE(requested_marketplace_fee, service_fee_amount, 0)
                        ELSE net_amount
                    END,
                    provider_status = COALESCE(provider_status, status)
                WHERE provider = 'mercadopago'
                """
            )
        )
        if op.get_bind().dialect.name != "sqlite":
            for column_name in ("gross_amount", "marketplace_fee", "net_amount", "retry_count"):
                if _has_column("payment_transactions", column_name):
                    op.alter_column("payment_transactions", column_name, server_default=None)
    _create_index("payment_transactions", ["provider_status"])


def upgrade() -> None:
    _ensure_provider_columns()
    _ensure_account_columns()
    _ensure_transaction_columns()


def downgrade() -> None:
    pass
