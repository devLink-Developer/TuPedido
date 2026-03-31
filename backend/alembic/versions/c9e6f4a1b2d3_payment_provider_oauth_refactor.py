"""payment_provider_oauth_refactor

Revision ID: c9e6f4a1b2d3
Revises: b7c9d1e2f314
Create Date: 2026-03-31 09:30:00.000000

"""

from __future__ import annotations

import os
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "c9e6f4a1b2d3"
down_revision: Union[str, None] = "b7c9d1e2f314"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _inspector() -> sa.Inspector:
    return sa.inspect(op.get_bind())


def _has_table(table_name: str) -> bool:
    return table_name in _inspector().get_table_names()


def _has_index(table_name: str, index_name: str) -> bool:
    return index_name in {index["name"] for index in _inspector().get_indexes(table_name)}


def _backfill_payment_provider() -> None:
    connection = op.get_bind()
    existing = connection.execute(
        sa.text("SELECT 1 FROM payment_providers WHERE provider = :provider"),
        {"provider": "mercadopago"},
    ).first()
    if existing is not None:
        return

    client_id = (os.getenv("MERCADOPAGO_CLIENT_ID") or "").strip() or None
    client_secret = (os.getenv("MERCADOPAGO_CLIENT_SECRET") or "").strip() or None
    redirect_uri = (os.getenv("MERCADOPAGO_REDIRECT_URI") or "").strip() or None
    mode = "production" if (os.getenv("MERCADOPAGO_MODE") or "").strip().lower() == "production" else "sandbox"
    enabled = bool(client_id and client_secret and redirect_uri)

    client_secret_encrypted = None
    if client_secret:
        from app.core.utils import encrypt_sensitive_value

        client_secret_encrypted = encrypt_sensitive_value(client_secret)

    connection.execute(
        sa.text(
            """
            INSERT INTO payment_providers (
                provider,
                client_id,
                client_secret_encrypted,
                redirect_uri,
                enabled,
                mode
            )
            VALUES (
                :provider,
                :client_id,
                :client_secret_encrypted,
                :redirect_uri,
                :enabled,
                :mode
            )
            """
        ),
        {
            "provider": "mercadopago",
            "client_id": client_id,
            "client_secret_encrypted": client_secret_encrypted,
            "redirect_uri": redirect_uri,
            "enabled": enabled,
            "mode": mode,
        },
    )


def _backfill_merchant_payment_accounts() -> None:
    if not _has_table("mercadopago_credentials"):
        return

    op.execute(
        sa.text(
            """
            INSERT INTO merchant_payment_accounts (
                store_id,
                provider,
                mp_user_id,
                public_key,
                access_token_encrypted,
                refresh_token_encrypted,
                expires_in,
                token_expires_at,
                connected,
                onboarding_completed,
                reconnect_required,
                created_at,
                updated_at
            )
            SELECT
                legacy.store_id,
                'mercadopago',
                legacy.collector_id,
                legacy.public_key,
                legacy.access_token_encrypted,
                legacy.refresh_token_encrypted,
                NULL,
                legacy.token_expires_at,
                CASE
                    WHEN legacy.is_configured = true
                        AND legacy.oauth_connected_at IS NOT NULL
                        AND legacy.access_token_encrypted IS NOT NULL
                        AND legacy.refresh_token_encrypted IS NOT NULL
                    THEN true
                    ELSE false
                END,
                CASE
                    WHEN legacy.is_configured = true
                        AND legacy.oauth_connected_at IS NOT NULL
                        AND legacy.access_token_encrypted IS NOT NULL
                        AND legacy.refresh_token_encrypted IS NOT NULL
                    THEN true
                    ELSE false
                END,
                COALESCE(legacy.reconnect_required, false),
                COALESCE(legacy.oauth_connected_at, legacy.updated_at, CURRENT_TIMESTAMP),
                COALESCE(legacy.updated_at, CURRENT_TIMESTAMP)
            FROM mercadopago_credentials AS legacy
            WHERE NOT EXISTS (
                SELECT 1
                FROM merchant_payment_accounts AS target
                WHERE target.store_id = legacy.store_id
                    AND target.provider = 'mercadopago'
            )
            """
        )
    )


def upgrade() -> None:
    if not _has_table("payment_providers"):
        op.create_table(
            "payment_providers",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("provider", sa.String(length=60), nullable=False),
            sa.Column("client_id", sa.String(length=255), nullable=True),
            sa.Column("client_secret_encrypted", sa.Text(), nullable=True),
            sa.Column("redirect_uri", sa.Text(), nullable=True),
            sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("mode", sa.String(length=20), nullable=False, server_default="sandbox"),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("(CURRENT_TIMESTAMP)"),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("(CURRENT_TIMESTAMP)"),
                nullable=False,
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("provider"),
        )
    if not _has_index("payment_providers", op.f("ix_payment_providers_id")):
        op.create_index(op.f("ix_payment_providers_id"), "payment_providers", ["id"], unique=False)
    if not _has_index("payment_providers", op.f("ix_payment_providers_provider")):
        op.create_index(op.f("ix_payment_providers_provider"), "payment_providers", ["provider"], unique=True)

    if not _has_table("merchant_payment_accounts"):
        op.create_table(
            "merchant_payment_accounts",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("store_id", sa.Integer(), nullable=False),
            sa.Column("provider", sa.String(length=60), nullable=False),
            sa.Column("mp_user_id", sa.String(length=120), nullable=True),
            sa.Column("public_key", sa.String(length=255), nullable=True),
            sa.Column("access_token_encrypted", sa.Text(), nullable=True),
            sa.Column("refresh_token_encrypted", sa.Text(), nullable=True),
            sa.Column("expires_in", sa.Integer(), nullable=True),
            sa.Column("token_expires_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("connected", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("onboarding_completed", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("reconnect_required", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("(CURRENT_TIMESTAMP)"),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("(CURRENT_TIMESTAMP)"),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(["store_id"], ["stores.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("store_id", "provider", name="uq_merchant_payment_accounts_store_provider"),
        )
    if not _has_index("merchant_payment_accounts", op.f("ix_merchant_payment_accounts_id")):
        op.create_index(op.f("ix_merchant_payment_accounts_id"), "merchant_payment_accounts", ["id"], unique=False)
    if not _has_index("merchant_payment_accounts", op.f("ix_merchant_payment_accounts_provider")):
        op.create_index(
            op.f("ix_merchant_payment_accounts_provider"),
            "merchant_payment_accounts",
            ["provider"],
            unique=False,
        )
    if not _has_index("merchant_payment_accounts", op.f("ix_merchant_payment_accounts_store_id")):
        op.create_index(
            op.f("ix_merchant_payment_accounts_store_id"),
            "merchant_payment_accounts",
            ["store_id"],
            unique=False,
        )

    _backfill_payment_provider()
    _backfill_merchant_payment_accounts()


def downgrade() -> None:
    if _has_table("merchant_payment_accounts"):
        if _has_index("merchant_payment_accounts", op.f("ix_merchant_payment_accounts_store_id")):
            op.drop_index(op.f("ix_merchant_payment_accounts_store_id"), table_name="merchant_payment_accounts")
        if _has_index("merchant_payment_accounts", op.f("ix_merchant_payment_accounts_provider")):
            op.drop_index(op.f("ix_merchant_payment_accounts_provider"), table_name="merchant_payment_accounts")
        if _has_index("merchant_payment_accounts", op.f("ix_merchant_payment_accounts_id")):
            op.drop_index(op.f("ix_merchant_payment_accounts_id"), table_name="merchant_payment_accounts")
        op.drop_table("merchant_payment_accounts")

    if _has_table("payment_providers"):
        if _has_index("payment_providers", op.f("ix_payment_providers_provider")):
            op.drop_index(op.f("ix_payment_providers_provider"), table_name="payment_providers")
        if _has_index("payment_providers", op.f("ix_payment_providers_id")):
            op.drop_index(op.f("ix_payment_providers_id"), table_name="payment_providers")
        op.drop_table("payment_providers")
