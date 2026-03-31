from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.platform import PlatformSettings


DEFAULT_SERVICE_FEE_AMOUNT = 350.0
DEFAULT_CATALOG_BANNER_WIDTH = 1600
DEFAULT_CATALOG_BANNER_HEIGHT = 520
DEFAULT_PLATFORM_USE_LOGO_AS_FAVICON = False
PLATFORM_SETTINGS_SINGLETON_ID = 1


def get_or_create_platform_settings(db: Session) -> PlatformSettings:
    settings = db.scalar(select(PlatformSettings).where(PlatformSettings.id == PLATFORM_SETTINGS_SINGLETON_ID))
    if settings is None:
        settings = PlatformSettings(
            id=PLATFORM_SETTINGS_SINGLETON_ID,
            service_fee_amount=DEFAULT_SERVICE_FEE_AMOUNT,
            platform_logo_url=None,
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
    settings = get_or_create_platform_settings(db)
    return float(settings.service_fee_amount)
