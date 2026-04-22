"""schema_convergence_post_merge

Revision ID: d2a7c6e5b401
Revises: c1f8e6a4b9d2
Create Date: 2026-04-02 21:50:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d2a7c6e5b401"
down_revision: Union[str, Sequence[str], None] = "c1f8e6a4b9d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEFAULT_CATEGORY_COLOR = "#9E9E9E"
DEFAULT_CATEGORY_LIGHT = "#F2F2F2"
DEFAULT_PLATFORM_BANNER_WIDTH = 1600
DEFAULT_PLATFORM_BANNER_HEIGHT = 520

CATEGORY_PALETTE = {
    "despensa": {"color": "#FF7043", "color_light": "#FBE9E7", "icon": "DS"},
    "kiosko": {"color": "#29B6F6", "color_light": "#E1F5FE", "icon": "KS"},
    "farmacia": {"color": "#66BB6A", "color_light": "#E8F5E9", "icon": "FX"},
    "carniceria": {"color": "#EF5350", "color_light": "#FFEBEE", "icon": "CR"},
    "polleria": {"color": "#FFCA28", "color_light": "#FFF8E1", "icon": "PL"},
    "restaurante": {"color": "#AB47BC", "color_light": "#F3E5F5", "icon": "RT"},
}


def _inspector() -> sa.Inspector:
    return sa.inspect(op.get_bind())


def _has_table(table_name: str) -> bool:
    return table_name in _inspector().get_table_names()


def _has_column(table_name: str, column_name: str) -> bool:
    return column_name in {column["name"] for column in _inspector().get_columns(table_name)}


def _has_index(table_name: str, index_name: str) -> bool:
    return index_name in {index["name"] for index in _inspector().get_indexes(table_name)}


def _has_unique_constraint(table_name: str, constraint_name: str) -> bool:
    return constraint_name in {item["name"] for item in _inspector().get_unique_constraints(table_name)}


def _has_foreign_key(table_name: str, constrained_columns: list[str], referred_table: str) -> bool:
    for foreign_key in _inspector().get_foreign_keys(table_name):
        if foreign_key.get("constrained_columns") != constrained_columns:
            continue
        if foreign_key.get("referred_table") != referred_table:
            continue
        return True
    return False


def _create_index(table_name: str, columns: list[str], *, unique: bool = False) -> None:
    index_name = op.f(f"ix_{table_name}_{'_'.join(columns)}")
    if _has_table(table_name) and not _has_index(table_name, index_name):
        op.create_index(index_name, table_name, columns, unique=unique)


def _ensure_category_visuals() -> None:
    if not _has_table("categories"):
        return

    if not _has_column("categories", "color"):
        op.add_column(
            "categories",
            sa.Column("color", sa.String(length=7), nullable=False, server_default=DEFAULT_CATEGORY_COLOR),
        )
    if not _has_column("categories", "color_light"):
        op.add_column("categories", sa.Column("color_light", sa.String(length=7), nullable=True))
    if not _has_column("categories", "icon"):
        op.add_column("categories", sa.Column("icon", sa.String(length=24), nullable=True))

    categories = sa.sql.table(
        "categories",
        sa.column("slug", sa.String()),
        sa.column("color", sa.String()),
        sa.column("color_light", sa.String()),
        sa.column("icon", sa.String()),
    )

    op.execute(
        categories.update()
        .where(sa.or_(categories.c.color.is_(None), categories.c.color == ""))
        .values(color=DEFAULT_CATEGORY_COLOR)
    )
    op.execute(
        categories.update()
        .where(sa.or_(categories.c.color_light.is_(None), categories.c.color_light == ""))
        .values(color_light=DEFAULT_CATEGORY_LIGHT)
    )

    for slug, values in CATEGORY_PALETTE.items():
        op.execute(
            categories.update()
            .where(categories.c.slug == slug)
            .values(
                color=values["color"],
                color_light=values["color_light"],
                icon=values["icon"],
            )
        )

    if op.get_bind().dialect.name != "sqlite" and _has_column("categories", "color"):
        op.alter_column("categories", "color", server_default=None)


def _ensure_platform_branding() -> None:
    if not _has_table("platform_settings"):
        return

    if not _has_column("platform_settings", "platform_logo_url"):
        op.add_column("platform_settings", sa.Column("platform_logo_url", sa.Text(), nullable=True))
    if not _has_column("platform_settings", "platform_wordmark_url"):
        op.add_column("platform_settings", sa.Column("platform_wordmark_url", sa.Text(), nullable=True))
    if not _has_column("platform_settings", "platform_favicon_url"):
        op.add_column("platform_settings", sa.Column("platform_favicon_url", sa.Text(), nullable=True))
    if not _has_column("platform_settings", "platform_use_logo_as_favicon"):
        op.add_column(
            "platform_settings",
            sa.Column("platform_use_logo_as_favicon", sa.Boolean(), nullable=False, server_default=sa.false()),
        )
    if not _has_column("platform_settings", "catalog_banner_image_url"):
        op.add_column("platform_settings", sa.Column("catalog_banner_image_url", sa.Text(), nullable=True))
    if not _has_column("platform_settings", "catalog_banner_width"):
        op.add_column(
            "platform_settings",
            sa.Column("catalog_banner_width", sa.Integer(), nullable=False, server_default=str(DEFAULT_PLATFORM_BANNER_WIDTH)),
        )
    if not _has_column("platform_settings", "catalog_banner_height"):
        op.add_column(
            "platform_settings",
            sa.Column("catalog_banner_height", sa.Integer(), nullable=False, server_default=str(DEFAULT_PLATFORM_BANNER_HEIGHT)),
        )

    if _has_column("platform_settings", "catalog_banner_width"):
        op.execute(
            sa.text(
                "UPDATE platform_settings "
                "SET catalog_banner_width = :width "
                "WHERE catalog_banner_width IS NULL"
            ).bindparams(width=DEFAULT_PLATFORM_BANNER_WIDTH)
        )
    if _has_column("platform_settings", "catalog_banner_height"):
        op.execute(
            sa.text(
                "UPDATE platform_settings "
                "SET catalog_banner_height = :height "
                "WHERE catalog_banner_height IS NULL"
            ).bindparams(height=DEFAULT_PLATFORM_BANNER_HEIGHT)
        )

    if op.get_bind().dialect.name != "sqlite":
        if _has_column("platform_settings", "platform_use_logo_as_favicon"):
            op.alter_column("platform_settings", "platform_use_logo_as_favicon", server_default=None)
        if _has_column("platform_settings", "catalog_banner_width"):
            op.alter_column("platform_settings", "catalog_banner_width", server_default=None)
        if _has_column("platform_settings", "catalog_banner_height"):
            op.alter_column("platform_settings", "catalog_banner_height", server_default=None)


def _ensure_transfer_notice_receipts() -> None:
    if not _has_table("merchant_transfer_notices"):
        return

    if not _has_column("merchant_transfer_notices", "proof_url"):
        op.add_column("merchant_transfer_notices", sa.Column("proof_url", sa.Text(), nullable=True))
    if not _has_column("merchant_transfer_notices", "proof_content_type"):
        op.add_column(
            "merchant_transfer_notices",
            sa.Column("proof_content_type", sa.String(length=120), nullable=True),
        )
    if not _has_column("merchant_transfer_notices", "proof_original_name"):
        op.add_column(
            "merchant_transfer_notices",
            sa.Column("proof_original_name", sa.String(length=255), nullable=True),
        )


def _ensure_promotions() -> None:
    if not _has_table("store_promotions"):
        op.create_table(
            "store_promotions",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("store_id", sa.Integer(), sa.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False),
            sa.Column("name", sa.String(length=180), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("sale_price", sa.Numeric(precision=10, scale=2), nullable=False),
            sa.Column("max_per_customer_per_day", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
    else:
        if not _has_column("store_promotions", "name"):
            op.add_column("store_promotions", sa.Column("name", sa.String(length=180), nullable=True))
        if not _has_column("store_promotions", "description"):
            op.add_column("store_promotions", sa.Column("description", sa.Text(), nullable=True))
        if not _has_column("store_promotions", "sale_price"):
            op.add_column("store_promotions", sa.Column("sale_price", sa.Numeric(precision=10, scale=2), nullable=True))
        if not _has_column("store_promotions", "max_per_customer_per_day"):
            op.add_column(
                "store_promotions",
                sa.Column("max_per_customer_per_day", sa.Integer(), nullable=False, server_default="1"),
            )
        if not _has_column("store_promotions", "is_active"):
            op.add_column(
                "store_promotions",
                sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            )
        if not _has_column("store_promotions", "sort_order"):
            op.add_column(
                "store_promotions",
                sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
            )
        if not _has_column("store_promotions", "created_at"):
            op.add_column(
                "store_promotions",
                sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            )
        if not _has_column("store_promotions", "updated_at"):
            op.add_column(
                "store_promotions",
                sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            )
    if op.get_bind().dialect.name != "sqlite":
        if _has_column("store_promotions", "max_per_customer_per_day"):
            op.alter_column("store_promotions", "max_per_customer_per_day", server_default=None)
        if _has_column("store_promotions", "sort_order"):
            op.alter_column("store_promotions", "sort_order", server_default=None)
    _create_index("store_promotions", ["id"])
    _create_index("store_promotions", ["store_id"])
    _create_index("store_promotions", ["is_active"])

    if not _has_table("store_promotion_items"):
        op.create_table(
            "store_promotion_items",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "promotion_id", sa.Integer(), sa.ForeignKey("store_promotions.id", ondelete="CASCADE"), nullable=False
            ),
            sa.Column("product_id", sa.Integer(), sa.ForeignKey("store_products.id", ondelete="CASCADE"), nullable=False),
            sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
            sa.UniqueConstraint("promotion_id", "product_id", name="uq_store_promotion_items_promotion_product"),
        )
    else:
        if not _has_column("store_promotion_items", "quantity"):
            op.add_column("store_promotion_items", sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"))
        if not _has_column("store_promotion_items", "sort_order"):
            op.add_column("store_promotion_items", sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"))
        if not _has_unique_constraint("store_promotion_items", "uq_store_promotion_items_promotion_product"):
            op.create_unique_constraint(
                "uq_store_promotion_items_promotion_product",
                "store_promotion_items",
                ["promotion_id", "product_id"],
            )
    if op.get_bind().dialect.name != "sqlite":
        if _has_column("store_promotion_items", "quantity"):
            op.alter_column("store_promotion_items", "quantity", server_default=None)
        if _has_column("store_promotion_items", "sort_order"):
            op.alter_column("store_promotion_items", "sort_order", server_default=None)
    _create_index("store_promotion_items", ["id"])
    _create_index("store_promotion_items", ["promotion_id"])
    _create_index("store_promotion_items", ["product_id"])

    if not _has_table("order_promotion_applications"):
        op.create_table(
            "order_promotion_applications",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("order_id", sa.Integer(), sa.ForeignKey("store_orders.id", ondelete="CASCADE"), nullable=False),
            sa.Column(
                "promotion_id", sa.Integer(), sa.ForeignKey("store_promotions.id", ondelete="SET NULL"), nullable=True
            ),
            sa.Column("promotion_name_snapshot", sa.String(length=180), nullable=False),
            sa.Column("sale_price_snapshot", sa.Numeric(precision=10, scale=2), nullable=False),
            sa.Column("combo_count", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("base_total_snapshot", sa.Numeric(precision=10, scale=2), nullable=False),
            sa.Column("discount_total_snapshot", sa.Numeric(precision=10, scale=2), nullable=False),
            sa.Column("items_snapshot_json", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
    else:
        needs_promotion_id_column = not _has_column("order_promotion_applications", "promotion_id")
        needs_promotion_id_fk = not _has_foreign_key(
            "order_promotion_applications",
            ["promotion_id"],
            "store_promotions",
        )
        if op.get_bind().dialect.name == "sqlite":
            if needs_promotion_id_column or needs_promotion_id_fk:
                with op.batch_alter_table("order_promotion_applications", recreate="always") as batch_op:
                    if needs_promotion_id_column:
                        batch_op.add_column(sa.Column("promotion_id", sa.Integer(), nullable=True))
                    if needs_promotion_id_fk:
                        batch_op.create_foreign_key(
                            "fk_order_promotion_applications_promotion_id_store_promotions",
                            "store_promotions",
                            ["promotion_id"],
                            ["id"],
                            ondelete="SET NULL",
                        )
        elif needs_promotion_id_column:
            op.add_column(
                "order_promotion_applications",
                sa.Column("promotion_id", sa.Integer(), sa.ForeignKey("store_promotions.id", ondelete="SET NULL"), nullable=True),
            )
        if not _has_column("order_promotion_applications", "promotion_name_snapshot"):
            op.add_column(
                "order_promotion_applications",
                sa.Column("promotion_name_snapshot", sa.String(length=180), nullable=True),
            )
        if not _has_column("order_promotion_applications", "sale_price_snapshot"):
            op.add_column(
                "order_promotion_applications",
                sa.Column("sale_price_snapshot", sa.Numeric(precision=10, scale=2), nullable=True),
            )
        if not _has_column("order_promotion_applications", "combo_count"):
            op.add_column(
                "order_promotion_applications",
                sa.Column("combo_count", sa.Integer(), nullable=False, server_default="1"),
            )
        if not _has_column("order_promotion_applications", "base_total_snapshot"):
            op.add_column(
                "order_promotion_applications",
                sa.Column("base_total_snapshot", sa.Numeric(precision=10, scale=2), nullable=True),
            )
        if not _has_column("order_promotion_applications", "discount_total_snapshot"):
            op.add_column(
                "order_promotion_applications",
                sa.Column("discount_total_snapshot", sa.Numeric(precision=10, scale=2), nullable=True),
            )
        if not _has_column("order_promotion_applications", "items_snapshot_json"):
            op.add_column("order_promotion_applications", sa.Column("items_snapshot_json", sa.Text(), nullable=True))
        if not _has_column("order_promotion_applications", "created_at"):
            op.add_column(
                "order_promotion_applications",
                sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            )
    if op.get_bind().dialect.name != "sqlite" and _has_column("order_promotion_applications", "combo_count"):
        op.alter_column("order_promotion_applications", "combo_count", server_default=None)
    _create_index("order_promotion_applications", ["id"])
    _create_index("order_promotion_applications", ["order_id"])
    _create_index("order_promotion_applications", ["promotion_id"])


def _ensure_rider_settlement_receivers() -> None:
    if not _has_table("rider_settlement_payments"):
        return

    if not _has_column("rider_settlement_payments", "receiver_status"):
        op.add_column(
            "rider_settlement_payments",
            sa.Column("receiver_status", sa.String(length=40), nullable=False, server_default="pending_confirmation"),
        )
    if not _has_column("rider_settlement_payments", "receiver_response_notes"):
        op.add_column("rider_settlement_payments", sa.Column("receiver_response_notes", sa.Text(), nullable=True))
    if not _has_column("rider_settlement_payments", "receiver_responded_at"):
        op.add_column(
            "rider_settlement_payments",
            sa.Column("receiver_responded_at", sa.DateTime(timezone=True), nullable=True),
        )
    if op.get_bind().dialect.name != "sqlite" and _has_column("rider_settlement_payments", "receiver_status"):
        op.alter_column("rider_settlement_payments", "receiver_status", server_default=None)
    _create_index("rider_settlement_payments", ["receiver_status"])


def upgrade() -> None:
    _ensure_category_visuals()
    _ensure_platform_branding()
    _ensure_transfer_notice_receipts()
    _ensure_promotions()
    _ensure_rider_settlement_receivers()


def downgrade() -> None:
    pass
