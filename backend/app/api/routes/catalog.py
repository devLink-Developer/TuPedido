from __future__ import annotations

import logging
from types import SimpleNamespace

from sqlalchemy import or_, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.presenters import (
    serialize_catalog_banner,
    serialize_category,
    serialize_platform_branding,
    serialize_store_detail,
    serialize_store_summary,
)
from app.core.utils import next_store_opening_at
from app.db.session import get_db
from app.models.store import Category, Product, ProductCategory, Store, StoreCategoryLink
from app.schemas.catalog import CatalogBannerRead, PlatformBrandingRead
from app.services.mercadopago import get_or_create_mercadopago_provider
from app.services.platform import get_platform_settings_snapshot, get_table_columns
from app.services.store_address import store_delivery_is_enabled, store_pickup_is_enabled
from app.services.store_coverage import has_valid_coordinates, store_covers_location

router = APIRouter()
logger = logging.getLogger(__name__)

STORE_LOAD_OPTIONS = (
    selectinload(Store.category_links).selectinload(StoreCategoryLink.category),
    selectinload(Store.hours),
    selectinload(Store.delivery_settings),
    selectinload(Store.payment_settings),
    selectinload(Store.payment_accounts),
    selectinload(Store.product_categories).selectinload(ProductCategory.subcategories),
    selectinload(Store.products).selectinload(Product.product_category),
    selectinload(Store.products).selectinload(Product.product_subcategory),
)

CATEGORY_PUBLIC_COLUMNS = (
    "id",
    "name",
    "slug",
    "description",
    "color",
    "color_light",
    "icon",
    "is_active",
    "sort_order",
)


@router.get("/categories")
def list_categories(db: Session = Depends(get_db)) -> list[dict[str, object]]:
    try:
        columns = get_table_columns(db, "categories")
        if not {"id", "name", "slug"}.issubset(columns):
            return []

        selected_columns = [column for column in CATEGORY_PUBLIC_COLUMNS if column in columns]
        filters = ["is_active = true"] if "is_active" in columns else []
        order_by = ["sort_order"] if "sort_order" in columns else []
        order_by.append("name")

        where_clause = f" WHERE {' AND '.join(filters)}" if filters else ""
        query = text(
            f"SELECT {', '.join(selected_columns)} "
            f"FROM categories{where_clause} "
            f"ORDER BY {', '.join(order_by)}"
        )
        rows = db.execute(query).mappings().all()
        return [serialize_category(SimpleNamespace(**dict(row))).model_dump() for row in rows]
    except SQLAlchemyError:
        logger.exception("catalog_categories_unavailable")
        return []


@router.get("/platform-banner", response_model=CatalogBannerRead)
def get_platform_banner(db: Session = Depends(get_db)) -> CatalogBannerRead:
    try:
        return serialize_catalog_banner(get_platform_settings_snapshot(db))
    except SQLAlchemyError:
        logger.exception("catalog_platform_banner_unavailable")
        return serialize_catalog_banner(SimpleNamespace())


@router.get("/platform-branding", response_model=PlatformBrandingRead)
def get_platform_branding(db: Session = Depends(get_db)) -> PlatformBrandingRead:
    try:
        return serialize_platform_branding(get_platform_settings_snapshot(db))
    except SQLAlchemyError:
        logger.exception("catalog_platform_branding_unavailable")
        return serialize_platform_branding(SimpleNamespace())


@router.get("/stores")
def list_stores(
    category_slug: str | None = Query(default=None),
    search: str | None = Query(default=None),
    delivery_mode: str | None = Query(default=None),
    latitude: float | None = Query(default=None),
    longitude: float | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[dict[str, object]]:
    if delivery_mode not in (None, "", "delivery", "pickup"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid delivery mode")
    if not has_valid_coordinates(latitude, longitude):
        return []

    query = (
        select(Store)
        .options(*STORE_LOAD_OPTIONS)
        .where(Store.status == "approved", Store.accepting_orders.is_(True))
    )
    if search:
        query = query.where(
            or_(
                Store.name.ilike(f"%{search}%"),
                Store.description.ilike(f"%{search}%"),
                Store.address.ilike(f"%{search}%"),
            )
        )
    if category_slug:
        query = query.join(Store.category_links).join(StoreCategoryLink.category).where(Category.slug == category_slug)

    stores = db.execute(query.order_by(Store.name)).scalars().unique().all()
    mercadopago_provider = get_or_create_mercadopago_provider(db)
    paired_results = [
        (
            store,
            serialize_store_summary(store, mercadopago_provider=mercadopago_provider),
        )
        for store in stores
    ]
    customer_latitude = float(latitude)
    customer_longitude = float(longitude)

    def covers_requested_mode(store: Store) -> bool:
        modes = [delivery_mode] if delivery_mode else ["delivery", "pickup"]
        for mode in modes:
            if mode == "delivery" and not store_delivery_is_enabled(store):
                continue
            if mode == "pickup" and not store_pickup_is_enabled(store):
                continue
            if store_covers_location(
                store,
                mode,  # type: ignore[arg-type]
                latitude=customer_latitude,
                longitude=customer_longitude,
            ):
                return True
        return False

    paired_results = [(store, summary) for store, summary in paired_results if covers_requested_mode(store)]

    def sort_key(item: tuple[Store, object]) -> tuple[int, int, str, str]:
        store, summary = item
        next_opening = next_store_opening_at(store)
        return (
            0 if summary.is_open else 1,
            0 if next_opening is not None else 1,
            next_opening.isoformat() if next_opening is not None else "",
            summary.name.lower(),
        )

    results = [summary for _, summary in sorted(paired_results, key=sort_key)]
    return [store.model_dump() for store in results]


@router.get("/stores/{slug}")
def get_store(
    slug: str,
    latitude: float | None = Query(default=None),
    longitude: float | None = Query(default=None),
    delivery_mode: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    if delivery_mode not in (None, "", "delivery", "pickup"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid delivery mode")
    if not has_valid_coordinates(latitude, longitude):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Customer location is required")

    store = db.scalar(select(Store).options(*STORE_LOAD_OPTIONS).where(Store.slug == slug, Store.status == "approved"))
    if store is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")
    customer_latitude = float(latitude)
    customer_longitude = float(longitude)
    modes = [delivery_mode] if delivery_mode else ["delivery", "pickup"]
    if not any(
        (
            mode == "delivery"
            and store_delivery_is_enabled(store)
            and store_covers_location(store, "delivery", latitude=customer_latitude, longitude=customer_longitude)
        )
        or (
            mode == "pickup"
            and store_pickup_is_enabled(store)
            and store_covers_location(store, "pickup", latitude=customer_latitude, longitude=customer_longitude)
        )
        for mode in modes
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")
    mercadopago_provider = get_or_create_mercadopago_provider(db)
    return serialize_store_detail(store, mercadopago_provider=mercadopago_provider).model_dump()
