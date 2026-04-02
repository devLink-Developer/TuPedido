from __future__ import annotations

from types import SimpleNamespace

import sqlalchemy as sa
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.platform import PlatformSettings


DEFAULT_SERVICE_FEE_AMOUNT = 350.0
DEFAULT_CATALOG_BANNER_WIDTH = 1600
DEFAULT_CATALOG_BANNER_HEIGHT = 520
DEFAULT_PLATFORM_USE_LOGO_AS_FAVICON = False
PLATFORM_SETTINGS_SINGLETON_ID = 1

PLATFORM_SETTINGS_COLUMNS = (
    "id",
    "service_fee_amount",
    "platform_logo_url",
    "platform_wordmark_url",
    "platform_favicon_url",
    "platform_use_logo_as_favicon",
    "catalog_banner_image_url",
    "catalog_banner_width",
    "catalog_banner_height",
    "updated_at",
)


def get_table_columns(db: Session, table_name: str) -> set[str]:
    inspector = sa.inspect(db.get_bind())
    if table_name not in inspector.get_table_names():
        return set()
    return {column["name"] for column in inspector.get_columns(table_name)}


def get_platform_settings_snapshot(db: Session) -> object:
    defaults = {
        "id": PLATFORM_SETTINGS_SINGLETON_ID,
        "service_fee_amount": DEFAULT_SERVICE_FEE_AMOUNT,
        "platform_logo_url": None,
        "platform_wordmark_url": None,
        "platform_favicon_url": None,
        "platform_use_logo_as_favicon": DEFAULT_PLATFORM_USE_LOGO_AS_FAVICON,
        "catalog_banner_image_url": None,
        "catalog_banner_width": DEFAULT_CATALOG_BANNER_WIDTH,
        "catalog_banner_height": DEFAULT_CATALOG_BANNER_HEIGHT,
        "updated_at": None,
    }
    columns = get_table_columns(db, "platform_settings")
    available_columns = [column for column in PLATFORM_SETTINGS_COLUMNS if column in columns]
    if not available_columns:
        return SimpleNamespace(**defaults)

    query = sa.text(
        f"SELECT {', '.join(available_columns)} "
        "FROM platform_settings "
        "WHERE id = :settings_id"
    )
    row = db.execute(query, {"settings_id": PLATFORM_SETTINGS_SINGLETON_ID}).mappings().first()
    if row is None:
        return SimpleNamespace(**defaults)

    payload = {**defaults, **dict(row)}
    return SimpleNamespace(**payload)


def get_or_create_platform_settings(db: Session) -> PlatformSettings:
    settings = db.scalar(select(PlatformSettings).where(PlatformSettings.id == PLATFORM_SETTINGS_SINGLETON_ID))
    if settings is None:
        settings = PlatformSettings(
            id=PLATFORM_SETTINGS_SINGLETON_ID,
            service_fee_amount=DEFAULT_SERVICE_FEE_AMOUNT,
            platform_logo_url=None,
            platform_wordmark_url=None,
            platform_favicon_url=None,
            platform_use_logo_as_favicon=DEFAULT_PLATFORM_USE_LOGO_AS_FAVICON,
            catalog_banner_image_url=None,
            catalog_banner_width=DEFAULT_CATALOG_BANNER_WIDTH,
            catalog_banner_height=DEFAULT_CATALOG_BANNER_HEIGHT,
        )
        db.add(settings)
        db.flush()
    return settings


def get_service_fee_amount(db: Session | None) -> float:
    if db is None:
        return DEFAULT_SERVICE_FEE_AMOUNT
    settings = get_platform_settings_snapshot(db)
    return float(getattr(settings, "service_fee_amount", DEFAULT_SERVICE_FEE_AMOUNT))
