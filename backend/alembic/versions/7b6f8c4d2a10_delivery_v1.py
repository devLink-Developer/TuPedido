"""delivery_v1

Revision ID: 7b6f8c4d2a10
Revises: 6f3de9324f76
Create Date: 2026-03-24 20:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7b6f8c4d2a10"
down_revision: Union[str, None] = "6f3de9324f76"
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


def _create_index(table_name: str, columns: list[str], *, unique: bool = False) -> None:
    index_name = op.f(f"ix_{table_name}_{'_'.join(columns)}")
    if not _has_index(table_name, index_name):
        op.create_index(index_name, table_name, columns, unique=unique)


def _drop_index(table_name: str, columns: list[str]) -> None:
    index_name = op.f(f"ix_{table_name}_{'_'.join(columns)}")
    if _has_table(table_name) and _has_index(table_name, index_name):
        op.drop_index(index_name, table_name=table_name)


def _drop_column(table_name: str, column_name: str) -> None:
    if _has_table(table_name) and _has_column(table_name, column_name):
        op.drop_column(table_name, column_name)


def upgrade() -> None:
    if _has_table("addresses"):
        if not _has_column("addresses", "latitude"):
            op.add_column("addresses", sa.Column("latitude", sa.Numeric(precision=10, scale=7), nullable=True))
        if not _has_column("addresses", "longitude"):
            op.add_column("addresses", sa.Column("longitude", sa.Numeric(precision=10, scale=7), nullable=True))

    if _has_table("stores"):
        if not _has_column("stores", "latitude"):
            op.add_column("stores", sa.Column("latitude", sa.Numeric(precision=10, scale=7), nullable=True))
        if not _has_column("stores", "longitude"):
            op.add_column("stores", sa.Column("longitude", sa.Numeric(precision=10, scale=7), nullable=True))

    if not _has_table("delivery_zones"):
        op.create_table(
            "delivery_zones",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=160), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("center_latitude", sa.Numeric(precision=10, scale=7), nullable=False),
            sa.Column("center_longitude", sa.Numeric(precision=10, scale=7), nullable=False),
            sa.Column("radius_km", sa.Numeric(precision=10, scale=2), nullable=False, server_default="5"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
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
            sa.UniqueConstraint("name"),
        )
    _create_index("delivery_zones", ["id"])
    _create_index("delivery_zones", ["is_active"])

    if not _has_table("delivery_zone_rates"):
        op.create_table(
            "delivery_zone_rates",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("zone_id", sa.Integer(), nullable=False),
            sa.Column("vehicle_type", sa.String(length=40), nullable=False),
            sa.Column("delivery_fee_customer", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0"),
            sa.Column("rider_fee", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0"),
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
            sa.ForeignKeyConstraint(["zone_id"], ["delivery_zones.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("zone_id", "vehicle_type", name="uq_delivery_zone_rates_zone_vehicle"),
        )
    _create_index("delivery_zone_rates", ["id"])
    _create_index("delivery_zone_rates", ["zone_id"])
    _create_index("delivery_zone_rates", ["vehicle_type"])

    if not _has_table("delivery_applications"):
        op.create_table(
            "delivery_applications",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("phone", sa.String(length=60), nullable=False),
            sa.Column("vehicle_type", sa.String(length=40), nullable=False),
            sa.Column("photo_url", sa.Text(), nullable=True),
            sa.Column("dni_number", sa.String(length=60), nullable=False),
            sa.Column("emergency_contact_name", sa.String(length=180), nullable=False),
            sa.Column("emergency_contact_phone", sa.String(length=60), nullable=False),
            sa.Column("license_number", sa.String(length=120), nullable=True),
            sa.Column("vehicle_plate", sa.String(length=60), nullable=True),
            sa.Column("insurance_policy", sa.String(length=180), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("status", sa.String(length=40), nullable=False, server_default="pending_review"),
            sa.Column("review_notes", sa.Text(), nullable=True),
            sa.Column("reviewed_by_user_id", sa.Integer(), nullable=True),
            sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
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
            sa.ForeignKeyConstraint(["reviewed_by_user_id"], ["users.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
    _create_index("delivery_applications", ["id"])
    _create_index("delivery_applications", ["user_id"])
    _create_index("delivery_applications", ["vehicle_type"])
    _create_index("delivery_applications", ["status"])
    _create_index("delivery_applications", ["reviewed_by_user_id"])

    if not _has_table("delivery_profiles"):
        op.create_table(
            "delivery_profiles",
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("application_id", sa.Integer(), nullable=True),
            sa.Column("phone", sa.String(length=60), nullable=False),
            sa.Column("vehicle_type", sa.String(length=40), nullable=False),
            sa.Column("photo_url", sa.Text(), nullable=True),
            sa.Column("dni_number", sa.String(length=60), nullable=False),
            sa.Column("emergency_contact_name", sa.String(length=180), nullable=False),
            sa.Column("emergency_contact_phone", sa.String(length=60), nullable=False),
            sa.Column("license_number", sa.String(length=120), nullable=True),
            sa.Column("vehicle_plate", sa.String(length=60), nullable=True),
            sa.Column("insurance_policy", sa.String(length=180), nullable=True),
            sa.Column("availability", sa.String(length=40), nullable=False, server_default="offline"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("current_zone_id", sa.Integer(), nullable=True),
            sa.Column("current_latitude", sa.Numeric(precision=10, scale=7), nullable=True),
            sa.Column("current_longitude", sa.Numeric(precision=10, scale=7), nullable=True),
            sa.Column("last_location_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("push_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("approved_by_user_id", sa.Integer(), nullable=True),
            sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("completed_deliveries", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("rating", sa.Numeric(precision=4, scale=2), nullable=False, server_default="0"),
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
            sa.ForeignKeyConstraint(["application_id"], ["delivery_applications.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["approved_by_user_id"], ["users.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["current_zone_id"], ["delivery_zones.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("user_id"),
            sa.UniqueConstraint("application_id"),
        )
    _create_index("delivery_profiles", ["application_id"], unique=True)
    _create_index("delivery_profiles", ["vehicle_type"])
    _create_index("delivery_profiles", ["availability"])
    _create_index("delivery_profiles", ["current_zone_id"])
    _create_index("delivery_profiles", ["approved_by_user_id"])

    if _has_table("store_orders"):
        if not _has_column("store_orders", "delivery_fee_customer"):
            op.add_column(
                "store_orders",
                sa.Column("delivery_fee_customer", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0"),
            )
        if not _has_column("store_orders", "rider_fee"):
            op.add_column(
                "store_orders",
                sa.Column("rider_fee", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0"),
            )
        if not _has_column("store_orders", "delivery_status"):
            op.add_column(
                "store_orders",
                sa.Column("delivery_status", sa.String(length=40), nullable=False, server_default="unassigned"),
            )
        if not _has_column("store_orders", "delivery_provider"):
            op.add_column(
                "store_orders",
                sa.Column("delivery_provider", sa.String(length=40), nullable=False, server_default="store"),
            )
        if not _has_column("store_orders", "delivery_zone_id"):
            op.add_column(
                "store_orders",
                sa.Column("delivery_zone_id", sa.Integer(), sa.ForeignKey("delivery_zones.id", ondelete="SET NULL"), nullable=True),
            )
        if not _has_column("store_orders", "assigned_rider_id"):
            op.add_column(
                "store_orders",
                sa.Column("assigned_rider_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            )
        if not _has_column("store_orders", "assigned_rider_name_snapshot"):
            op.add_column("store_orders", sa.Column("assigned_rider_name_snapshot", sa.String(length=180), nullable=True))
        if not _has_column("store_orders", "assigned_rider_phone_masked"):
            op.add_column("store_orders", sa.Column("assigned_rider_phone_masked", sa.String(length=60), nullable=True))
        if not _has_column("store_orders", "assigned_rider_vehicle_type"):
            op.add_column("store_orders", sa.Column("assigned_rider_vehicle_type", sa.String(length=40), nullable=True))
        if not _has_column("store_orders", "tracking_last_latitude"):
            op.add_column("store_orders", sa.Column("tracking_last_latitude", sa.Numeric(precision=10, scale=7), nullable=True))
        if not _has_column("store_orders", "tracking_last_longitude"):
            op.add_column("store_orders", sa.Column("tracking_last_longitude", sa.Numeric(precision=10, scale=7), nullable=True))
        if not _has_column("store_orders", "tracking_last_at"):
            op.add_column("store_orders", sa.Column("tracking_last_at", sa.DateTime(timezone=True), nullable=True))
        if not _has_column("store_orders", "tracking_stale"):
            op.add_column("store_orders", sa.Column("tracking_stale", sa.Boolean(), nullable=False, server_default=sa.false()))
        if not _has_column("store_orders", "eta_minutes"):
            op.add_column("store_orders", sa.Column("eta_minutes", sa.Integer(), nullable=True))
        if not _has_column("store_orders", "otp_code"):
            op.add_column("store_orders", sa.Column("otp_code", sa.String(length=12), nullable=True))
        if not _has_column("store_orders", "otp_required"):
            op.add_column("store_orders", sa.Column("otp_required", sa.Boolean(), nullable=False, server_default=sa.false()))
        if not _has_column("store_orders", "otp_verified_at"):
            op.add_column("store_orders", sa.Column("otp_verified_at", sa.DateTime(timezone=True), nullable=True))
        if not _has_column("store_orders", "merchant_ready_at"):
            op.add_column("store_orders", sa.Column("merchant_ready_at", sa.DateTime(timezone=True), nullable=True))
        if not _has_column("store_orders", "out_for_delivery_at"):
            op.add_column("store_orders", sa.Column("out_for_delivery_at", sa.DateTime(timezone=True), nullable=True))
        if not _has_column("store_orders", "delivered_at"):
            op.add_column("store_orders", sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True))
    _create_index("store_orders", ["delivery_zone_id"])
    _create_index("store_orders", ["assigned_rider_id"])
    _create_index("store_orders", ["delivery_status"])

    if not _has_table("delivery_assignments"):
        op.create_table(
            "delivery_assignments",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("order_id", sa.Integer(), nullable=False),
            sa.Column("rider_user_id", sa.Integer(), nullable=True),
            sa.Column("zone_id", sa.Integer(), nullable=True),
            sa.Column("status", sa.String(length=40), nullable=False, server_default="unassigned"),
            sa.Column("vehicle_type_snapshot", sa.String(length=40), nullable=True),
            sa.Column("offer_expires_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("picked_up_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("near_customer_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("failed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("current_latitude", sa.Numeric(precision=10, scale=7), nullable=True),
            sa.Column("current_longitude", sa.Numeric(precision=10, scale=7), nullable=True),
            sa.Column("current_heading", sa.Numeric(precision=10, scale=2), nullable=True),
            sa.Column("current_speed_kmh", sa.Numeric(precision=10, scale=2), nullable=True),
            sa.Column("last_eta_minutes", sa.Integer(), nullable=True),
            sa.Column("distance_km", sa.Numeric(precision=10, scale=2), nullable=True),
            sa.Column("last_heartbeat_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("tracking_stale", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("otp_code", sa.String(length=12), nullable=True),
            sa.Column("otp_verified_at", sa.DateTime(timezone=True), nullable=True),
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
            sa.ForeignKeyConstraint(["order_id"], ["store_orders.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["rider_user_id"], ["users.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["zone_id"], ["delivery_zones.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("order_id"),
        )
    _create_index("delivery_assignments", ["id"])
    _create_index("delivery_assignments", ["order_id"], unique=True)
    _create_index("delivery_assignments", ["rider_user_id"])
    _create_index("delivery_assignments", ["zone_id"])
    _create_index("delivery_assignments", ["status"])

    if not _has_table("delivery_location_points"):
        op.create_table(
            "delivery_location_points",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("assignment_id", sa.Integer(), nullable=False),
            sa.Column("latitude", sa.Numeric(precision=10, scale=7), nullable=False),
            sa.Column("longitude", sa.Numeric(precision=10, scale=7), nullable=False),
            sa.Column("heading", sa.Numeric(precision=10, scale=2), nullable=True),
            sa.Column("speed_kmh", sa.Numeric(precision=10, scale=2), nullable=True),
            sa.Column("accuracy_meters", sa.Numeric(precision=10, scale=2), nullable=True),
            sa.Column(
                "recorded_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("(CURRENT_TIMESTAMP)"),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(["assignment_id"], ["delivery_assignments.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
    _create_index("delivery_location_points", ["id"])
    _create_index("delivery_location_points", ["assignment_id"])
    _create_index("delivery_location_points", ["recorded_at"])

    if not _has_table("notification_events"):
        op.create_table(
            "notification_events",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("order_id", sa.Integer(), nullable=True),
            sa.Column("channel", sa.String(length=40), nullable=False, server_default="in_app"),
            sa.Column("event_type", sa.String(length=80), nullable=False),
            sa.Column("title", sa.String(length=180), nullable=False),
            sa.Column("body", sa.Text(), nullable=False),
            sa.Column("payload_json", sa.Text(), nullable=True),
            sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("push_status", sa.String(length=40), nullable=False, server_default="pending"),
            sa.Column("push_attempted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("(CURRENT_TIMESTAMP)"),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(["order_id"], ["store_orders.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
    _create_index("notification_events", ["id"])
    _create_index("notification_events", ["user_id"])
    _create_index("notification_events", ["order_id"])
    _create_index("notification_events", ["event_type"])
    _create_index("notification_events", ["is_read"])
    _create_index("notification_events", ["push_status"])
    _create_index("notification_events", ["created_at"])

    if not _has_table("push_subscriptions"):
        op.create_table(
            "push_subscriptions",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("endpoint", sa.Text(), nullable=False),
            sa.Column("p256dh", sa.Text(), nullable=False),
            sa.Column("auth", sa.Text(), nullable=False),
            sa.Column("user_agent", sa.Text(), nullable=True),
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
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("endpoint"),
        )
    _create_index("push_subscriptions", ["id"])
    _create_index("push_subscriptions", ["user_id"])

    if not _has_table("rider_settlement_charges"):
        op.create_table(
            "rider_settlement_charges",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("rider_user_id", sa.Integer(), nullable=False),
            sa.Column("order_id", sa.Integer(), nullable=False),
            sa.Column("entry_type", sa.String(length=40), nullable=False),
            sa.Column("amount", sa.Numeric(precision=10, scale=2), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("(CURRENT_TIMESTAMP)"),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(["order_id"], ["store_orders.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["rider_user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("order_id"),
        )
    _create_index("rider_settlement_charges", ["id"])
    _create_index("rider_settlement_charges", ["rider_user_id"])
    _create_index("rider_settlement_charges", ["order_id"], unique=True)
    _create_index("rider_settlement_charges", ["entry_type"])

    if not _has_table("rider_settlement_payments"):
        op.create_table(
            "rider_settlement_payments",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("rider_user_id", sa.Integer(), nullable=False),
            sa.Column("source", sa.String(length=40), nullable=False, server_default="admin_manual"),
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
            sa.ForeignKeyConstraint(["rider_user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
    _create_index("rider_settlement_payments", ["id"])
    _create_index("rider_settlement_payments", ["rider_user_id"])
    _create_index("rider_settlement_payments", ["created_by_user_id"])

    if not _has_table("rider_settlement_allocations"):
        op.create_table(
            "rider_settlement_allocations",
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
            sa.ForeignKeyConstraint(["charge_id"], ["rider_settlement_charges.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["payment_id"], ["rider_settlement_payments.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
    _create_index("rider_settlement_allocations", ["id"])
    _create_index("rider_settlement_allocations", ["payment_id"])
    _create_index("rider_settlement_allocations", ["charge_id"])

    if not _has_table("merchant_cash_delivery_payables"):
        op.create_table(
            "merchant_cash_delivery_payables",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("store_id", sa.Integer(), nullable=False),
            sa.Column("order_id", sa.Integer(), nullable=False),
            sa.Column("amount", sa.Numeric(precision=10, scale=2), nullable=False),
            sa.Column("status", sa.String(length=40), nullable=False, server_default="pending"),
            sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
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
    _create_index("merchant_cash_delivery_payables", ["id"])
    _create_index("merchant_cash_delivery_payables", ["store_id"])
    _create_index("merchant_cash_delivery_payables", ["order_id"], unique=True)
    _create_index("merchant_cash_delivery_payables", ["status"])

    if _has_table("store_orders"):
        op.execute(
            sa.text(
                """
                UPDATE store_orders
                SET delivery_fee_customer = COALESCE(delivery_fee, 0)
                WHERE COALESCE(delivery_fee_customer, 0) = 0
                """
            )
        )
        op.execute(
            sa.text(
                """
                UPDATE store_orders
                SET delivery_provider = CASE
                    WHEN delivery_mode = 'pickup' THEN 'pickup'
                    WHEN delivery_provider IS NULL OR delivery_provider = '' THEN 'store'
                    ELSE delivery_provider
                END
                """
            )
        )
        op.execute(
            sa.text(
                """
                UPDATE store_orders
                SET delivery_status = CASE
                    WHEN delivery_mode = 'pickup' THEN 'delivered'
                    WHEN status = 'cancelled' THEN 'failed'
                    WHEN status = 'delivered' THEN 'delivered'
                    WHEN status = 'out_for_delivery' THEN 'picked_up'
                    ELSE COALESCE(NULLIF(delivery_status, ''), 'unassigned')
                END
                """
            )
        )
        for column_name in (
            "delivery_fee_customer",
            "rider_fee",
            "delivery_status",
            "delivery_provider",
            "tracking_stale",
            "otp_required",
        ):
            if _has_column("store_orders", column_name):
                op.alter_column("store_orders", column_name, server_default=None)

    for table_name, column_name in (
        ("delivery_zones", "radius_km"),
        ("delivery_zones", "is_active"),
        ("delivery_zone_rates", "delivery_fee_customer"),
        ("delivery_zone_rates", "rider_fee"),
        ("delivery_applications", "status"),
        ("delivery_profiles", "availability"),
        ("delivery_profiles", "is_active"),
        ("delivery_profiles", "push_enabled"),
        ("delivery_profiles", "completed_deliveries"),
        ("delivery_profiles", "rating"),
        ("delivery_assignments", "status"),
        ("delivery_assignments", "tracking_stale"),
        ("notification_events", "channel"),
        ("notification_events", "is_read"),
        ("notification_events", "push_status"),
        ("rider_settlement_payments", "source"),
        ("merchant_cash_delivery_payables", "status"),
    ):
        if _has_column(table_name, column_name):
            op.alter_column(table_name, column_name, server_default=None)



def downgrade() -> None:
    for table_name, columns in (
        ("merchant_cash_delivery_payables", ["status", "order_id", "store_id", "id"]),
        ("rider_settlement_allocations", ["charge_id", "payment_id", "id"]),
        ("rider_settlement_payments", ["created_by_user_id", "rider_user_id", "id"]),
        ("rider_settlement_charges", ["entry_type", "order_id", "rider_user_id", "id"]),
        ("push_subscriptions", ["user_id", "id"]),
        ("notification_events", ["created_at", "push_status", "is_read", "event_type", "order_id", "user_id", "id"]),
        ("delivery_location_points", ["recorded_at", "assignment_id", "id"]),
        ("delivery_assignments", ["status", "zone_id", "rider_user_id", "order_id", "id"]),
        ("store_orders", ["delivery_status", "assigned_rider_id", "delivery_zone_id"]),
        ("delivery_profiles", ["approved_by_user_id", "current_zone_id", "availability", "vehicle_type", "application_id"]),
        ("delivery_applications", ["reviewed_by_user_id", "status", "vehicle_type", "user_id", "id"]),
        ("delivery_zone_rates", ["vehicle_type", "zone_id", "id"]),
        ("delivery_zones", ["is_active", "id"]),
    ):
        for column_name in columns:
            _drop_index(table_name, [column_name])

    for table_name in (
        "merchant_cash_delivery_payables",
        "rider_settlement_allocations",
        "rider_settlement_payments",
        "rider_settlement_charges",
        "push_subscriptions",
        "notification_events",
        "delivery_location_points",
        "delivery_assignments",
        "delivery_profiles",
        "delivery_applications",
        "delivery_zone_rates",
        "delivery_zones",
    ):
        if _has_table(table_name):
            op.drop_table(table_name)

    for table_name, column_name in (
        ("store_orders", "delivered_at"),
        ("store_orders", "out_for_delivery_at"),
        ("store_orders", "merchant_ready_at"),
        ("store_orders", "otp_verified_at"),
        ("store_orders", "otp_required"),
        ("store_orders", "otp_code"),
        ("store_orders", "eta_minutes"),
        ("store_orders", "tracking_stale"),
        ("store_orders", "tracking_last_at"),
        ("store_orders", "tracking_last_longitude"),
        ("store_orders", "tracking_last_latitude"),
        ("store_orders", "assigned_rider_vehicle_type"),
        ("store_orders", "assigned_rider_phone_masked"),
        ("store_orders", "assigned_rider_name_snapshot"),
        ("store_orders", "assigned_rider_id"),
        ("store_orders", "delivery_zone_id"),
        ("store_orders", "delivery_provider"),
        ("store_orders", "delivery_status"),
        ("store_orders", "rider_fee"),
        ("store_orders", "delivery_fee_customer"),
        ("stores", "longitude"),
        ("stores", "latitude"),
        ("addresses", "longitude"),
        ("addresses", "latitude"),
    ):
        _drop_column(table_name, column_name)
