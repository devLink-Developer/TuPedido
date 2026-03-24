"""service_fee_split_settlements

Revision ID: 6f3de9324f76
Revises: d9ba94f281ec
Create Date: 2026-03-24 16:10:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "6f3de9324f76"
down_revision: Union[str, None] = "d9ba94f281ec"
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


def upgrade() -> None:
    if not _has_column("shopping_carts", "service_fee"):
        op.add_column(
            "shopping_carts",
            sa.Column("service_fee", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0"),
        )
    if not _has_column("store_orders", "service_fee"):
        op.add_column(
            "store_orders",
            sa.Column("service_fee", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0"),
        )

    if not _has_column("mercadopago_credentials", "refresh_token_encrypted"):
        op.add_column("mercadopago_credentials", sa.Column("refresh_token_encrypted", sa.Text(), nullable=True))
    if not _has_column("mercadopago_credentials", "collector_id"):
        op.add_column("mercadopago_credentials", sa.Column("collector_id", sa.String(length=120), nullable=True))
    if not _has_column("mercadopago_credentials", "scope"):
        op.add_column("mercadopago_credentials", sa.Column("scope", sa.String(length=180), nullable=True))
    if not _has_column("mercadopago_credentials", "live_mode"):
        op.add_column(
            "mercadopago_credentials",
            sa.Column("live_mode", sa.Boolean(), nullable=False, server_default=sa.false()),
        )
    if not _has_column("mercadopago_credentials", "token_expires_at"):
        op.add_column("mercadopago_credentials", sa.Column("token_expires_at", sa.DateTime(timezone=True), nullable=True))
    if not _has_column("mercadopago_credentials", "oauth_connected_at"):
        op.add_column("mercadopago_credentials", sa.Column("oauth_connected_at", sa.DateTime(timezone=True), nullable=True))
    if not _has_column("mercadopago_credentials", "reconnect_required"):
        op.add_column(
            "mercadopago_credentials",
            sa.Column("reconnect_required", sa.Boolean(), nullable=False, server_default=sa.false()),
        )

    if not _has_table("platform_settings"):
        op.create_table(
            "platform_settings",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("service_fee_amount", sa.Numeric(precision=10, scale=2), nullable=False),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("(CURRENT_TIMESTAMP)"),
                nullable=False,
            ),
            sa.PrimaryKeyConstraint("id"),
        )
    op.execute(
        sa.text(
            "INSERT INTO platform_settings (id, service_fee_amount) "
            "SELECT 1, 350.00 WHERE NOT EXISTS (SELECT 1 FROM platform_settings WHERE id = 1)"
        )
    )

    if not _has_table("merchant_service_fee_charges"):
        op.create_table(
            "merchant_service_fee_charges",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("store_id", sa.Integer(), nullable=False),
            sa.Column("order_id", sa.Integer(), nullable=False),
            sa.Column("amount", sa.Numeric(precision=10, scale=2), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("(CURRENT_TIMESTAMP)"),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(["order_id"], ["store_orders.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["store_id"], ["stores.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("order_id"),
        )
    if not _has_index("merchant_service_fee_charges", op.f("ix_merchant_service_fee_charges_id")):
        op.create_index(op.f("ix_merchant_service_fee_charges_id"), "merchant_service_fee_charges", ["id"], unique=False)
    if not _has_index("merchant_service_fee_charges", op.f("ix_merchant_service_fee_charges_order_id")):
        op.create_index(
            op.f("ix_merchant_service_fee_charges_order_id"),
            "merchant_service_fee_charges",
            ["order_id"],
            unique=True,
        )
    if not _has_index("merchant_service_fee_charges", op.f("ix_merchant_service_fee_charges_store_id")):
        op.create_index(
            op.f("ix_merchant_service_fee_charges_store_id"),
            "merchant_service_fee_charges",
            ["store_id"],
            unique=False,
        )

    if not _has_table("merchant_transfer_notices"):
        op.create_table(
            "merchant_transfer_notices",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("store_id", sa.Integer(), nullable=False),
            sa.Column("amount", sa.Numeric(precision=10, scale=2), nullable=False),
            sa.Column("transfer_date", sa.Date(), nullable=False),
            sa.Column("bank", sa.String(length=120), nullable=False),
            sa.Column("reference", sa.String(length=180), nullable=False),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("status", sa.String(length=40), nullable=False),
            sa.Column("review_notes", sa.Text(), nullable=True),
            sa.Column("reviewed_by_user_id", sa.Integer(), nullable=True),
            sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("(CURRENT_TIMESTAMP)"),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(["reviewed_by_user_id"], ["users.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["store_id"], ["stores.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
    if not _has_index("merchant_transfer_notices", op.f("ix_merchant_transfer_notices_id")):
        op.create_index(op.f("ix_merchant_transfer_notices_id"), "merchant_transfer_notices", ["id"], unique=False)
    if not _has_index("merchant_transfer_notices", op.f("ix_merchant_transfer_notices_reviewed_by_user_id")):
        op.create_index(
            op.f("ix_merchant_transfer_notices_reviewed_by_user_id"),
            "merchant_transfer_notices",
            ["reviewed_by_user_id"],
            unique=False,
        )
    if not _has_index("merchant_transfer_notices", op.f("ix_merchant_transfer_notices_status")):
        op.create_index(op.f("ix_merchant_transfer_notices_status"), "merchant_transfer_notices", ["status"], unique=False)
    if not _has_index("merchant_transfer_notices", op.f("ix_merchant_transfer_notices_store_id")):
        op.create_index(op.f("ix_merchant_transfer_notices_store_id"), "merchant_transfer_notices", ["store_id"], unique=False)

    if not _has_table("merchant_settlement_payments"):
        op.create_table(
            "merchant_settlement_payments",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("store_id", sa.Integer(), nullable=False),
            sa.Column("notice_id", sa.Integer(), nullable=True),
            sa.Column("source", sa.String(length=40), nullable=False),
            sa.Column("amount", sa.Numeric(precision=10, scale=2), nullable=False),
            sa.Column("paid_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("reference", sa.String(length=180), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("created_by_user_id", sa.Integer(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("(CURRENT_TIMESTAMP)"),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["notice_id"], ["merchant_transfer_notices.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["store_id"], ["stores.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("notice_id"),
        )
    if not _has_index("merchant_settlement_payments", op.f("ix_merchant_settlement_payments_created_by_user_id")):
        op.create_index(
            op.f("ix_merchant_settlement_payments_created_by_user_id"),
            "merchant_settlement_payments",
            ["created_by_user_id"],
            unique=False,
        )
    if not _has_index("merchant_settlement_payments", op.f("ix_merchant_settlement_payments_id")):
        op.create_index(op.f("ix_merchant_settlement_payments_id"), "merchant_settlement_payments", ["id"], unique=False)
    if not _has_index("merchant_settlement_payments", op.f("ix_merchant_settlement_payments_notice_id")):
        op.create_index(
            op.f("ix_merchant_settlement_payments_notice_id"),
            "merchant_settlement_payments",
            ["notice_id"],
            unique=True,
        )
    if not _has_index("merchant_settlement_payments", op.f("ix_merchant_settlement_payments_store_id")):
        op.create_index(
            op.f("ix_merchant_settlement_payments_store_id"),
            "merchant_settlement_payments",
            ["store_id"],
            unique=False,
        )

    if not _has_table("merchant_settlement_allocations"):
        op.create_table(
            "merchant_settlement_allocations",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("payment_id", sa.Integer(), nullable=False),
            sa.Column("charge_id", sa.Integer(), nullable=False),
            sa.Column("amount", sa.Numeric(precision=10, scale=2), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("(CURRENT_TIMESTAMP)"),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(["charge_id"], ["merchant_service_fee_charges.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["payment_id"], ["merchant_settlement_payments.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
    if not _has_index("merchant_settlement_allocations", op.f("ix_merchant_settlement_allocations_charge_id")):
        op.create_index(
            op.f("ix_merchant_settlement_allocations_charge_id"),
            "merchant_settlement_allocations",
            ["charge_id"],
            unique=False,
        )
    if not _has_index("merchant_settlement_allocations", op.f("ix_merchant_settlement_allocations_id")):
        op.create_index(op.f("ix_merchant_settlement_allocations_id"), "merchant_settlement_allocations", ["id"], unique=False)
    if not _has_index("merchant_settlement_allocations", op.f("ix_merchant_settlement_allocations_payment_id")):
        op.create_index(
            op.f("ix_merchant_settlement_allocations_payment_id"),
            "merchant_settlement_allocations",
            ["payment_id"],
            unique=False,
        )

    if _has_column("shopping_carts", "service_fee"):
        op.alter_column("shopping_carts", "service_fee", server_default=None)
    if _has_column("store_orders", "service_fee"):
        op.alter_column("store_orders", "service_fee", server_default=None)
    if _has_column("mercadopago_credentials", "live_mode"):
        op.alter_column("mercadopago_credentials", "live_mode", server_default=None)
    if _has_column("mercadopago_credentials", "reconnect_required"):
        op.alter_column("mercadopago_credentials", "reconnect_required", server_default=None)


def downgrade() -> None:
    op.drop_index(op.f("ix_merchant_settlement_allocations_payment_id"), table_name="merchant_settlement_allocations")
    op.drop_index(op.f("ix_merchant_settlement_allocations_id"), table_name="merchant_settlement_allocations")
    op.drop_index(op.f("ix_merchant_settlement_allocations_charge_id"), table_name="merchant_settlement_allocations")
    op.drop_table("merchant_settlement_allocations")

    op.drop_index(op.f("ix_merchant_settlement_payments_store_id"), table_name="merchant_settlement_payments")
    op.drop_index(op.f("ix_merchant_settlement_payments_notice_id"), table_name="merchant_settlement_payments")
    op.drop_index(op.f("ix_merchant_settlement_payments_id"), table_name="merchant_settlement_payments")
    op.drop_index(op.f("ix_merchant_settlement_payments_created_by_user_id"), table_name="merchant_settlement_payments")
    op.drop_table("merchant_settlement_payments")

    op.drop_index(op.f("ix_merchant_transfer_notices_store_id"), table_name="merchant_transfer_notices")
    op.drop_index(op.f("ix_merchant_transfer_notices_status"), table_name="merchant_transfer_notices")
    op.drop_index(op.f("ix_merchant_transfer_notices_reviewed_by_user_id"), table_name="merchant_transfer_notices")
    op.drop_index(op.f("ix_merchant_transfer_notices_id"), table_name="merchant_transfer_notices")
    op.drop_table("merchant_transfer_notices")

    op.drop_index(op.f("ix_merchant_service_fee_charges_store_id"), table_name="merchant_service_fee_charges")
    op.drop_index(op.f("ix_merchant_service_fee_charges_order_id"), table_name="merchant_service_fee_charges")
    op.drop_index(op.f("ix_merchant_service_fee_charges_id"), table_name="merchant_service_fee_charges")
    op.drop_table("merchant_service_fee_charges")

    op.drop_table("platform_settings")

    op.drop_column("mercadopago_credentials", "reconnect_required")
    op.drop_column("mercadopago_credentials", "oauth_connected_at")
    op.drop_column("mercadopago_credentials", "token_expires_at")
    op.drop_column("mercadopago_credentials", "live_mode")
    op.drop_column("mercadopago_credentials", "scope")
    op.drop_column("mercadopago_credentials", "collector_id")
    op.drop_column("mercadopago_credentials", "refresh_token_encrypted")

    op.drop_column("store_orders", "service_fee")
    op.drop_column("shopping_carts", "service_fee")
