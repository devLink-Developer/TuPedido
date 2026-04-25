"""payment_transactions_mp_split_audit

Revision ID: e6b8f9c1d204
Revises: d2a7c6e5b401
Create Date: 2026-04-24 22:05:00.000000
"""

from __future__ import annotations

import os
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e6b8f9c1d204"
down_revision: Union[str, Sequence[str], None] = "d2a7c6e5b401"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _inspector() -> sa.Inspector:
    return sa.inspect(op.get_bind())


def _has_table(table_name: str) -> bool:
    return table_name in _inspector().get_table_names()


def _has_column(table_name: str, column_name: str) -> bool:
    if not _has_table(table_name):
        return False
    return column_name in {column["name"] for column in _inspector().get_columns(table_name)}


def _has_index(table_name: str, index_name: str) -> bool:
    if not _has_table(table_name):
        return False
    return index_name in {index["name"] for index in _inspector().get_indexes(table_name)}


def _has_unique_constraint(table_name: str, constraint_name: str) -> bool:
    if not _has_table(table_name):
        return False
    return constraint_name in {item["name"] for item in _inspector().get_unique_constraints(table_name)}


def _create_index(table_name: str, columns: list[str], *, unique: bool = False) -> None:
    index_name = op.f(f"ix_{table_name}_{'_'.join(columns)}")
    if _has_table(table_name) and not _has_index(table_name, index_name):
        op.create_index(index_name, table_name, columns, unique=unique)


def _add_provider_columns() -> None:
    if _has_table("payment_providers") and not _has_column("payment_providers", "webhook_secret_encrypted"):
        op.add_column("payment_providers", sa.Column("webhook_secret_encrypted", sa.Text(), nullable=True))
    if _has_table("payment_providers") and _has_column("payment_providers", "webhook_secret_encrypted"):
        webhook_secret = (os.getenv("MERCADOPAGO_WEBHOOK_SECRET") or "").strip()
        if webhook_secret:
            from app.core.utils import encrypt_sensitive_value

            op.execute(
                sa.text(
                    """
                    UPDATE payment_providers
                    SET webhook_secret_encrypted = :webhook_secret_encrypted
                    WHERE provider = 'mercadopago'
                        AND webhook_secret_encrypted IS NULL
                    """
                ).bindparams(
                    webhook_secret_encrypted=encrypt_sensitive_value(webhook_secret)
                )
            )

    if _has_table("merchant_payment_accounts"):
        if not _has_column("merchant_payment_accounts", "scope"):
            op.add_column("merchant_payment_accounts", sa.Column("scope", sa.String(length=180), nullable=True))
        if not _has_column("merchant_payment_accounts", "live_mode"):
            op.add_column("merchant_payment_accounts", sa.Column("live_mode", sa.Boolean(), nullable=True))
        op.execute(
            sa.text(
                """
                UPDATE merchant_payment_accounts
                SET scope = COALESCE(scope, 'offline_access payments write'),
                    live_mode = COALESCE(live_mode, false)
                WHERE provider = 'mercadopago'
                """
            )
        )


def _create_payment_transactions() -> None:
    if not _has_table("payment_transactions"):
        op.create_table(
            "payment_transactions",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("order_id", sa.Integer(), nullable=False),
            sa.Column("store_id", sa.Integer(), nullable=False),
            sa.Column("provider", sa.String(length=60), nullable=False),
            sa.Column("external_reference", sa.String(length=120), nullable=False),
            sa.Column("preference_id", sa.String(length=160), nullable=True),
            sa.Column("payment_id", sa.String(length=160), nullable=True),
            sa.Column("idempotency_key", sa.String(length=160), nullable=True),
            sa.Column("status", sa.String(length=40), nullable=False),
            sa.Column("status_detail", sa.String(length=120), nullable=True),
            sa.Column("amount_total", sa.Numeric(precision=10, scale=2), nullable=False),
            sa.Column("currency", sa.String(length=3), nullable=False),
            sa.Column("requested_marketplace_fee", sa.Numeric(precision=10, scale=2), nullable=False),
            sa.Column("approved_marketplace_fee", sa.Numeric(precision=10, scale=2), nullable=True),
            sa.Column("seller_expected_amount", sa.Numeric(precision=10, scale=2), nullable=False),
            sa.Column("delivery_fee_amount", sa.Numeric(precision=10, scale=2), nullable=False),
            sa.Column("service_fee_amount", sa.Numeric(precision=10, scale=2), nullable=False),
            sa.Column("mp_user_id", sa.String(length=120), nullable=True),
            sa.Column("live_mode", sa.Boolean(), nullable=True),
            sa.Column("checkout_url", sa.Text(), nullable=True),
            sa.Column("raw_payment_json", sa.Text(), nullable=True),
            sa.Column("preference_raw_json", sa.Text(), nullable=True),
            sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["order_id"], ["store_orders.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["store_id"], ["stores.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("order_id"),
            sa.UniqueConstraint("provider", "external_reference", name="uq_payment_transactions_provider_reference"),
            sa.UniqueConstraint("provider", "payment_id", name="uq_payment_transactions_provider_payment_id"),
            sa.UniqueConstraint("provider", "preference_id", name="uq_payment_transactions_provider_preference_id"),
            sa.UniqueConstraint(
                "provider",
                "idempotency_key",
                name="uq_payment_transactions_provider_idempotency_key",
            ),
        )
    _create_index("payment_transactions", ["id"])
    _create_index("payment_transactions", ["order_id"], unique=True)
    _create_index("payment_transactions", ["store_id"])
    _create_index("payment_transactions", ["provider"])
    _create_index("payment_transactions", ["external_reference"])
    _create_index("payment_transactions", ["preference_id"])
    _create_index("payment_transactions", ["payment_id"])
    _create_index("payment_transactions", ["idempotency_key"])
    _create_index("payment_transactions", ["status"])


def _create_webhook_events() -> None:
    if not _has_table("payment_webhook_events"):
        op.create_table(
            "payment_webhook_events",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("provider", sa.String(length=60), nullable=False),
            sa.Column("event_id", sa.String(length=160), nullable=False),
            sa.Column("request_id", sa.String(length=160), nullable=True),
            sa.Column("payment_id", sa.String(length=160), nullable=True),
            sa.Column("external_reference", sa.String(length=120), nullable=True),
            sa.Column("signature_valid", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("payload_json", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("provider", "event_id", "request_id", name="uq_payment_webhook_events_provider_event_request"),
        )
    _create_index("payment_webhook_events", ["id"])
    _create_index("payment_webhook_events", ["provider"])
    _create_index("payment_webhook_events", ["event_id"])
    _create_index("payment_webhook_events", ["request_id"])
    _create_index("payment_webhook_events", ["payment_id"])
    _create_index("payment_webhook_events", ["external_reference"])


def _backfill_mercadopago_transactions() -> None:
    if not _has_table("payment_transactions") or not _has_table("store_orders"):
        return
    op.execute(
        sa.text(
            """
            INSERT INTO payment_transactions (
                order_id,
                store_id,
                provider,
                external_reference,
                status,
                amount_total,
                currency,
                requested_marketplace_fee,
                approved_marketplace_fee,
                seller_expected_amount,
                delivery_fee_amount,
                service_fee_amount,
                mp_user_id,
                live_mode,
                created_at,
                updated_at
            )
            SELECT
                orders.id,
                orders.store_id,
                'mercadopago',
                orders.payment_reference,
                COALESCE(orders.payment_status, 'pending'),
                COALESCE(orders.total, 0),
                'ARS',
                COALESCE(orders.service_fee, 0),
                NULL,
                COALESCE(orders.total, 0) - COALESCE(orders.service_fee, 0),
                COALESCE(orders.delivery_fee_customer, orders.delivery_fee, 0),
                COALESCE(orders.service_fee, 0),
                accounts.mp_user_id,
                accounts.live_mode,
                COALESCE(orders.created_at, CURRENT_TIMESTAMP),
                CURRENT_TIMESTAMP
            FROM store_orders AS orders
            LEFT JOIN merchant_payment_accounts AS accounts
                ON accounts.store_id = orders.store_id
                AND accounts.provider = 'mercadopago'
            LEFT JOIN payment_transactions AS existing
                ON existing.provider = 'mercadopago'
                AND existing.external_reference = orders.payment_reference
            WHERE orders.payment_method = 'mercadopago'
                AND orders.payment_reference IS NOT NULL
                AND existing.id IS NULL
            """
        )
    )


def upgrade() -> None:
    _add_provider_columns()
    _create_payment_transactions()
    _create_webhook_events()
    _backfill_mercadopago_transactions()


def downgrade() -> None:
    if _has_table("payment_webhook_events"):
        op.drop_table("payment_webhook_events")
    if _has_table("payment_transactions"):
        op.drop_table("payment_transactions")
    if _has_table("merchant_payment_accounts"):
        if _has_column("merchant_payment_accounts", "live_mode"):
            op.drop_column("merchant_payment_accounts", "live_mode")
        if _has_column("merchant_payment_accounts", "scope"):
            op.drop_column("merchant_payment_accounts", "scope")
    if _has_table("payment_providers") and _has_column("payment_providers", "webhook_secret_encrypted"):
        op.drop_column("payment_providers", "webhook_secret_encrypted")
