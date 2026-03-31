from __future__ import annotations

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.presenters import serialize_catalog_banner, serialize_category, serialize_store_detail, serialize_store_summary
from app.core.utils import next_store_opening_at
from app.db.session import get_db
from app.models.store import Category, Product, ProductCategory, Store, StoreCategoryLink
from app.schemas.catalog import CatalogBannerRead
from app.services.mercadopago import get_or_create_mercadopago_provider
from app.services.platform import get_or_create_platform_settings

router = APIRouter()

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


@router.get("/categories")
def list_categories(db: Session = Depends(get_db)) -> list[dict[str, object]]:
    categories = db.scalars(
        select(Category).where(Category.is_active.is_(True)).order_by(Category.sort_order, Category.name)
    ).all()
    return [serialize_category(category).model_dump() for category in categories]


@router.get("/platform-banner", response_model=CatalogBannerRead)
def get_platform_banner(db: Session = Depends(get_db)) -> CatalogBannerRead:
    return serialize_catalog_banner(get_or_create_platform_settings(db))


@router.get("/stores")
def list_stores(
    category_slug: str | None = Query(default=None),
    search: str | None = Query(default=None),
    delivery_mode: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[dict[str, object]]:
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
    if delivery_mode:
        if delivery_mode == "delivery":
            paired_results = [
                (store, summary)
                for store, summary in paired_results
                if summary.delivery_settings.delivery_enabled
            ]
        if delivery_mode == "pickup":
            paired_results = [
                (store, summary)
                for store, summary in paired_results
                if summary.delivery_settings.pickup_enabled
            ]

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
def get_store(slug: str, db: Session = Depends(get_db)) -> dict[str, object]:
    store = db.scalar(select(Store).options(*STORE_LOAD_OPTIONS).where(Store.slug == slug, Store.status == "approved"))
    if store is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")
    mercadopago_provider = get_or_create_mercadopago_provider(db)
    return serialize_store_detail(store, mercadopago_provider=mercadopago_provider).model_dump()
