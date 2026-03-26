from __future__ import annotations

from datetime import time

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import require_admin
from app.api.presenters import serialize_application, serialize_category, serialize_order, serialize_store_detail, serialize_store_summary
from app.core.security import hash_password
from app.core.utils import slugify
from app.db.session import get_db
from app.models.order import StoreOrder
from app.models.store import (
    Category,
    Product,
    ProductCategory,
    Store,
    StoreCategoryLink,
    StoreDeliverySettings,
    StoreHour,
    StorePaymentSettings,
)
from app.models.user import MerchantApplication, User
from app.schemas.admin import AdminMerchantCreate, StoreStatusUpdate
from app.schemas.auth import UserRead
from app.schemas.catalog import CategoryCreate, CategoryUpdate
from app.schemas.merchant import MerchantApplicationReviewUpdate
from app.services.category_colors import resolve_category_palette
from app.services.store_branding import resolve_store_assets

router = APIRouter()

STORE_OPTIONS = (
    selectinload(Store.category_links).selectinload(StoreCategoryLink.category),
    selectinload(Store.hours),
    selectinload(Store.delivery_settings),
    selectinload(Store.payment_settings),
    selectinload(Store.mercadopago_credentials),
    selectinload(Store.product_categories).selectinload(ProductCategory.subcategories),
    selectinload(Store.products).selectinload(Product.product_category),
    selectinload(Store.products).selectinload(Product.product_subcategory),
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


def get_categories_or_400(db: Session, category_ids: list[int]) -> list[Category]:
    unique_category_ids = list(dict.fromkeys(category_ids))
    categories = db.scalars(select(Category).where(Category.id.in_(unique_category_ids))).all() if unique_category_ids else []
    if len(categories) != len(unique_category_ids):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown categories")
    categories_by_id = {category.id: category for category in categories}
    return [categories_by_id[category_id] for category_id in unique_category_ids]


def assign_category_payload(category: Category, payload: CategoryCreate | CategoryUpdate) -> None:
    color, color_light = resolve_category_palette(payload.color, payload.color_light)
    category.name = payload.name.strip()
    category.slug = slugify(payload.name.strip())
    category.description = payload.description
    category.color = color
    category.color_light = color_light
    category.icon = (payload.icon or "").strip() or None
    category.is_active = payload.is_active
    category.sort_order = payload.sort_order


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
    slug = slugify(payload.name.strip())
    if not slug:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Category name is required")
    existing = db.scalar(select(Category).where(Category.slug == slug))
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Category already exists")
    category = Category(name=payload.name.strip(), slug=slug)
    assign_category_payload(category, payload)
    db.add(category)
    db.commit()
    db.refresh(category)
    return serialize_category(category).model_dump()


@router.put("/categories/{category_id}")
def update_category(
    category_id: int,
    payload: CategoryUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    category = db.get(Category, category_id)
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    slug = slugify(payload.name.strip())
    if not slug:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Category name is required")
    existing = db.scalar(select(Category).where(Category.slug == slug, Category.id != category_id))
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Category already exists")
    assign_category_payload(category, payload)
    db.commit()
    db.refresh(category)
    return serialize_category(category).model_dump()


@router.delete("/categories/{category_id}")
def delete_category(
    category_id: int,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    category = db.get(Category, category_id)
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    category.is_active = False
    db.commit()
    db.refresh(category)
    return serialize_category(category).model_dump()


@router.post("/stores", status_code=status.HTTP_201_CREATED)
def create_store(
    payload: AdminMerchantCreate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    existing_user = db.scalar(select(User).where(User.email == payload.email))
    if existing_user is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    if payload.max_delivery_minutes < payload.min_delivery_minutes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="max_delivery_minutes must be >= min_delivery_minutes")

    categories = get_categories_or_400(db, payload.category_ids)
    assets = resolve_store_assets(categories)

    user = User(
        full_name=payload.full_name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role="merchant",
        is_active=True,
    )
    db.add(user)
    db.flush()

    application = MerchantApplication(
        user_id=user.id,
        business_name=payload.business_name,
        description=payload.description,
        address=payload.address,
        phone=payload.phone,
        logo_url=payload.logo_url or assets["logo_url"],
        cover_image_url=payload.cover_image_url or assets["cover_image_url"],
        requested_category_ids=[category.id for category in categories],
        status="approved",
        review_notes=payload.review_notes or "Alta directa por admin",
    )
    db.add(application)
    db.flush()

    store = Store(
        owner_user_id=user.id,
        application_id=application.id,
        slug=build_unique_store_slug(db, payload.business_name),
        name=payload.business_name,
        description=payload.description,
        address=payload.address,
        phone=payload.phone,
        logo_url=payload.logo_url or assets["logo_url"],
        cover_image_url=payload.cover_image_url or assets["cover_image_url"],
        latitude=payload.latitude,
        longitude=payload.longitude,
        status="approved",
        accepting_orders=payload.accepting_orders,
        opening_note=payload.opening_note,
        min_delivery_minutes=payload.min_delivery_minutes,
        max_delivery_minutes=payload.max_delivery_minutes,
    )
    db.add(store)
    db.flush()

    db.add(
        StoreDeliverySettings(
            store_id=store.id,
            delivery_enabled=payload.delivery_enabled,
            pickup_enabled=payload.pickup_enabled,
            delivery_fee=payload.delivery_fee,
            min_order=payload.min_order,
        )
    )
    db.add(
        StorePaymentSettings(
            store_id=store.id,
            cash_enabled=payload.cash_enabled,
            mercadopago_enabled=payload.mercadopago_enabled,
        )
    )
    for hour in default_hours():
        hour.store_id = store.id
        db.add(hour)

    store.category_links = [
        StoreCategoryLink(store_id=store.id, category_id=category.id, is_primary=index == 0)
        for index, category in enumerate(categories)
    ]

    db.commit()
    created_store = db.scalar(select(Store).options(*STORE_OPTIONS).where(Store.id == store.id))
    assert created_store is not None
    return serialize_store_detail(created_store).model_dump()


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
    if payload.review_notes is not None:
        application.review_notes = payload.review_notes
    elif payload.status == "approved":
        application.review_notes = (
            "Solicitud aprobada. Ingresa con el mismo email y contrasena de tu cuenta para administrar tu comercio."
        )
    elif payload.status == "rejected":
        application.review_notes = "Solicitud rechazada. Revisa los datos y vuelve a postularte cuando estes listo."
    elif payload.status == "suspended":
        application.review_notes = "Solicitud suspendida temporalmente. Contacta al equipo para continuar el proceso."

    if payload.status == "approved":
        if not application.requested_category_ids:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Application must include at least one category")

        categories = get_categories_or_400(db, application.requested_category_ids)
        assets = resolve_store_assets(categories)
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
                logo_url=application.logo_url or assets["logo_url"],
                cover_image_url=application.cover_image_url or assets["cover_image_url"],
                status="approved",
                accepting_orders=False,
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
            store.status = "approved"
            store.logo_url = store.logo_url or application.logo_url or assets["logo_url"]
            store.cover_image_url = store.cover_image_url or application.cover_image_url or assets["cover_image_url"]
        store.category_links = [
            StoreCategoryLink(store_id=store.id, category_id=category.id, is_primary=index == 0)
            for index, category in enumerate(categories)
        ]
        application.user.role = "merchant"
    elif payload.status == "rejected" and application.user.role != "admin":
        if application.store is not None:
            application.store.status = "rejected"
            application.store.accepting_orders = False
        application.user.role = "customer"
    elif payload.status == "suspended" and application.store is not None:
        application.store.status = "suspended"
        application.store.accepting_orders = False

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


@router.get("/users")
def list_users(_: User = Depends(require_admin), db: Session = Depends(get_db)) -> list[dict[str, object]]:
    users = db.scalars(select(User).order_by(User.id.desc())).all()
    return [UserRead.model_validate(user).model_dump() for user in users]
