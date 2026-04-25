from __future__ import annotations

import logging
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from alembic.util.exc import CommandError
from sqlalchemy import inspect, text

from app.core.config import settings
from app.db.session import engine

INITIAL_REVISION = "d9ba94f281ec"
logger = logging.getLogger(__name__)
MANAGED_TABLES = {
    "addresses",
    "categories",
    "merchant_applications",
    "merchant_payment_accounts",
    "mercadopago_credentials",
    "payment_transactions",
    "payment_webhook_events",
    "payment_providers",
    "product_categories",
    "product_subcategories",
    "shopping_cart_items",
    "shopping_carts",
    "store_category_links",
    "store_delivery_settings",
    "store_hours",
    "store_order_items",
    "store_orders",
    "store_payment_settings",
    "store_products",
    "stores",
    "users",
}

MERGE_RECOVERY_SCHEMA: dict[str, set[str]] = {
    "platform_settings": {
        "service_fee_amount",
        "platform_logo_url",
        "platform_wordmark_url",
        "platform_favicon_url",
        "platform_use_logo_as_favicon",
        "catalog_banner_image_url",
        "catalog_banner_width",
        "catalog_banner_height",
    },
    "merchant_transfer_notices": {"proof_url", "proof_content_type", "proof_original_name"},
    "store_promotions": {"sale_price", "max_per_customer_per_day", "is_active", "sort_order"},
    "store_promotion_items": {"quantity", "sort_order"},
    "order_promotion_applications": {"promotion_id", "discount_total_snapshot", "items_snapshot_json"},
    "rider_settlement_payments": {
        "receiver_status",
        "receiver_response_notes",
        "receiver_responded_at",
    },
    "payment_providers": {"webhook_secret_encrypted"},
    "merchant_payment_accounts": {"scope", "live_mode"},
    "payment_transactions": {
        "external_reference",
        "requested_marketplace_fee",
        "seller_expected_amount",
        "service_fee_amount",
    },
    "payment_webhook_events": {"event_id", "signature_valid"},
}


def _project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _alembic_config() -> Config:
    project_root = _project_root()
    config = Config(str(project_root / "alembic.ini"))
    config.set_main_option("script_location", str(project_root / "alembic"))
    config.set_main_option("sqlalchemy.url", settings.database_url)
    return config


def _needs_legacy_stamp() -> bool:
    with engine.connect() as connection:
        inspector = inspect(connection)
        tables = set(inspector.get_table_names())
    if "alembic_version" in tables:
        return False
    return bool(MANAGED_TABLES & tables)


def _schema_matches_recovered_head() -> bool:
    with engine.connect() as connection:
        inspector = inspect(connection)
        for table_name, required_columns in MERGE_RECOVERY_SCHEMA.items():
            if table_name not in inspector.get_table_names():
                return False
            available_columns = {column["name"] for column in inspector.get_columns(table_name)}
            if not required_columns.issubset(available_columns):
                return False
    return True


def _recover_merge_head(config: Config) -> bool:
    heads = ScriptDirectory.from_config(config).get_heads()
    if len(heads) != 1:
        return False
    if not _schema_matches_recovered_head():
        return False

    head_revision = heads[0]
    with engine.begin() as connection:
        connection.execute(text("DELETE FROM alembic_version"))
        connection.execute(
            text("INSERT INTO alembic_version (version_num) VALUES (:version_num)"),
            {"version_num": head_revision},
        )
    logger.warning("Recovered Alembic merge state by forcing alembic_version to head %s", head_revision)
    return True


def _is_revision_resolution_error(exc: Exception) -> bool:
    if isinstance(exc, KeyError):
        return True
    if not isinstance(exc, CommandError):
        return False

    message = str(exc).lower()
    return (
        "can't locate revision identified by" in message
        or "requested revision" in message
        or "overlaps with other requested revisions" in message
        or "multiple heads are present" in message
    )


def run_schema_migrations() -> None:
    config = _alembic_config()
    if _needs_legacy_stamp():
        command.stamp(config, INITIAL_REVISION)
    try:
        command.upgrade(config, "head")
    except Exception as exc:
        if _is_revision_resolution_error(exc) and _recover_merge_head(config):
            command.upgrade(config, "head")
            return
        logger.exception("Schema migration failed during startup.")
        raise
