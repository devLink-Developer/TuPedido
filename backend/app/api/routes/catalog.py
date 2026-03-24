from __future__ import annotations

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.presenters import serialize_category, serialize_store_detail, serialize_store_summary
from app.core.utils import next_store_opening_at
from app.db.session import get_db
from app.models.store import Category, Product, Store, StoreCategoryLink

router = APIRouter()

STORE_LOAD_OPTIONS = (
    selectinload(Store.category_links).selectinload(StoreCategoryLink.category),
    selectinload(Store.hours),
    selectinload(Store.delivery_settings),
    selectinload(Store.payment_settings),
    selectinload(Store.mercadopago_credentials),
    selectinload(Store.product_categories),
    selectinload(Store.products).selectinload(Product.product_category),
)


@router.get("/categories")
def list_categories(db: Session = Depends(get_db)) -> list[dict[str, object]]:
    categories = db.scalars(
        select(Category).where(Category.is_active.is_(True)).order_by(Category.sort_order, Category.name)
    ).all()
    return [serialize_category(category).model_dump() for category in categories]


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
    paired_results = [(store, serialize_store_summary(store)) for store in stores]
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
    return serialize_store_detail(store).model_dump()
