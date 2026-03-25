from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect

from app.core.config import settings
from app.db.session import engine

INITIAL_REVISION = "d9ba94f281ec"
MANAGED_TABLES = {
    "addresses",
    "categories",
    "merchant_applications",
    "mercadopago_credentials",
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


def run_schema_migrations() -> None:
    config = _alembic_config()
    if _needs_legacy_stamp():
        command.stamp(config, INITIAL_REVISION)
    command.upgrade(config, "head")
