from __future__ import annotations

from datetime import time

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import require_admin
from app.api.presenters import serialize_application, serialize_category, serialize_order, serialize_store_detail, serialize_store_summary
from app.core.utils import slugify
from app.db.session import get_db
from app.models.order import StoreOrder
from app.models.store import (
    Category,
    Product,
    Store,
    StoreCategoryLink,
    StoreDeliverySettings,
    StoreHour,
    StorePaymentSettings,
)
from app.models.user import MerchantApplication, User
from app.schemas.admin import StoreStatusUpdate
from app.schemas.catalog import CategoryCreate
from app.schemas.merchant import MerchantApplicationReviewUpdate

router = APIRouter()

STORE_OPTIONS = (
    selectinload(Store.category_links).selectinload(StoreCategoryLink.category),
    selectinload(Store.hours),
    selectinload(Store.delivery_settings),
    selectinload(Store.payment_settings),
    selectinload(Store.mercadopago_credentials),
    selectinload(Store.product_categories),
    selectinload(Store.products).selectinload(Product.product_category),
)

APPLICATION_OPTIONS = (
    selectinload(MerchantApplication.user),
    selectinload(MerchantApplication.store),
)

ORDER_OPTIONS = (
    selectinload(StoreOrder.items),
    selectinload(StoreOrder.store),
)


def build_unique_store_slug(db: Session, base_value: str, exclude_store_id: int | None = None) -> str:
    base_slug = slugify(base_value)
    candidate = base_slug
    counter = 2
    while True:
        existing = db.scalar(select(Store).where(Store.slug == candidate))
        if existing is None or existing.id == exclude_store_id:
            return candidate
        candidate = f"{base_slug}-{counter}"
        counter += 1


def default_hours() -> list[StoreHour]:
    return [
        StoreHour(day_of_week=day, opens_at=time(hour=0), closes_at=time(hour=23, minute=59), is_closed=False)
        for day in range(7)
    ]


def attach_requested_categories(db: Session, application: MerchantApplication) -> MerchantApplication:
    category_ids = list(application.requested_category_ids or [])
    categories = db.scalars(select(Category).where(Category.id.in_(category_ids))).all() if category_ids else []
    setattr(application, "requested_categories", categories)
    return application


@router.get("/categories")
def list_categories(_: User = Depends(require_admin), db: Session = Depends(get_db)) -> list[dict[str, object]]:
    categories = db.scalars(select(Category).order_by(Category.sort_order, Category.name)).all()
    return [serialize_category(category).model_dump() for category in categories]


@router.post("/categories", status_code=status.HTTP_201_CREATED)
def create_category(
    payload: CategoryCreate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    slug = slugify(payload.name)
    existing = db.scalar(select(Category).where(Category.slug == slug))
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Category already exists")
    category = Category(name=payload.name, slug=slug, description=payload.description)
    db.add(category)
    db.commit()
    db.refresh(category)
    return serialize_category(category).model_dump()


@router.get("/stores/applications")
def list_applications(
    _: User = Depends(require_admin), db: Session = Depends(get_db)
) -> list[dict[str, object]]:
    applications = db.scalars(
        select(MerchantApplication).options(*APPLICATION_OPTIONS).order_by(MerchantApplication.id.desc())
    ).all()
    return [serialize_application(attach_requested_categories(db, application)).model_dump() for application in applications]


@router.put("/stores/applications/{application_id}")
def review_application(
    application_id: int,
    payload: MerchantApplicationReviewUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    application = db.scalar(
        select(MerchantApplication).options(*APPLICATION_OPTIONS).where(MerchantApplication.id == application_id)
    )
    if application is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    application.status = payload.status
    application.review_notes = payload.review_notes

    if payload.status == "approved":
        if not application.requested_category_ids:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Application must include at least one category")

        store = db.scalar(select(Store).options(*STORE_OPTIONS).where(Store.owner_user_id == application.user_id))
        if store is None:
            store = Store(
                owner_user_id=application.user_id,
                application_id=application.id,
                slug=build_unique_store_slug(db, application.business_name),
                name=application.business_name,
                description=application.description,
                address=application.address,
                phone=application.phone,
                logo_url=application.logo_url,
                cover_image_url=application.cover_image_url,
                status="approved",
                accepting_orders=True,
            )
            db.add(store)
            db.flush()
            db.add(StoreDeliverySettings(store_id=store.id, delivery_enabled=True, pickup_enabled=True, delivery_fee=0, min_order=0))
            db.add(StorePaymentSettings(store_id=store.id, cash_enabled=True, mercadopago_enabled=False))
            for hour in default_hours():
                hour.store_id = store.id
                db.add(hour)
        else:
            store.application_id = application.id
            store.name = application.business_name
            store.description = application.description
            store.address = application.address
            store.phone = application.phone
            store.logo_url = application.logo_url
            store.cover_image_url = application.cover_image_url
            store.status = "approved"

        categories = db.scalars(select(Category).where(Category.id.in_(application.requested_category_ids))).all()
        if len(categories) != len(application.requested_category_ids):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Application references unknown categories")
        store.category_links = [
            StoreCategoryLink(store_id=store.id, category_id=category.id, is_primary=index == 0)
            for index, category in enumerate(categories)
        ]
        application.user.role = "merchant"
    elif payload.status == "rejected" and application.user.role != "admin":
        application.user.role = "customer"

    db.commit()
    db.refresh(application)
    return serialize_application(attach_requested_categories(db, application)).model_dump()


@router.get("/stores")
def list_stores(_: User = Depends(require_admin), db: Session = Depends(get_db)) -> list[dict[str, object]]:
    stores = db.scalars(select(Store).options(*STORE_OPTIONS).order_by(Store.name)).all()
    return [serialize_store_summary(store).model_dump() for store in stores]


@router.put("/stores/{store_id}/status")
def update_store_status(
    store_id: int,
    payload: StoreStatusUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    store = db.scalar(select(Store).options(*STORE_OPTIONS).where(Store.id == store_id))
    if store is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")
    store.status = payload.status
    if payload.status != "approved":
        store.accepting_orders = False
    db.commit()
    db.refresh(store)
    return serialize_store_detail(store).model_dump()


@router.get("/orders")
def list_orders(_: User = Depends(require_admin), db: Session = Depends(get_db)) -> list[dict[str, object]]:
    orders = db.scalars(select(StoreOrder).options(*ORDER_OPTIONS).order_by(StoreOrder.id.desc())).all()
    return [serialize_order(order).model_dump() for order in orders]
