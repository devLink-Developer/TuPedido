from __future__ import annotations

from datetime import time

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user
from app.api.presenters import serialize_application
from app.core.security import create_access_token, hash_password
from app.core.utils import slugify
from app.db.session import get_db
from app.models.store import Category, Store, StoreCategoryLink, StoreDeliverySettings, StoreHour, StorePaymentSettings
from app.models.user import MerchantApplication, User
from app.schemas.auth import AuthResponse, UserRead
from app.schemas.merchant import MerchantApplicationCreate, MerchantApplicationRegister
from app.services.store_branding import resolve_store_assets

router = APIRouter()


def attach_requested_categories(db: Session, application: MerchantApplication) -> MerchantApplication:
    category_ids = list(application.requested_category_ids or [])
    if category_ids:
        categories = db.scalars(select(Category).where(Category.id.in_(category_ids))).all()
    else:
        categories = []
    setattr(application, "requested_categories", categories)
    return application


def get_categories_or_400(db: Session, requested_category_ids: list[int]) -> list[Category]:
    unique_category_ids = list(dict.fromkeys(requested_category_ids))
    if not unique_category_ids:
        return []
    categories = db.scalars(
        select(Category).where(Category.id.in_(unique_category_ids), Category.is_active.is_(True))
    ).all()
    if len(categories) != len(unique_category_ids):
        found_ids = {category.id for category in categories}
        missing = [category_id for category_id in unique_category_ids if category_id not in found_ids]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown category ids: {', '.join(str(item) for item in missing)}",
        )
    categories_by_id = {category.id: category for category in categories}
    return [categories_by_id[category_id] for category_id in unique_category_ids]


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


def ensure_pending_store(
    db: Session,
    *,
    user: User,
    application: MerchantApplication,
    categories: list[Category],
) -> Store:
    assets = resolve_store_assets(categories)
    store = db.scalar(select(Store).where(Store.owner_user_id == user.id))

    if store is None:
        store = Store(
            owner_user_id=user.id,
            application_id=application.id,
            slug=build_unique_store_slug(db, application.business_name),
            name=application.business_name,
            description=application.description,
            address=application.address,
            phone=application.phone,
            logo_url=application.logo_url or assets["logo_url"],
            cover_image_url=application.cover_image_url or assets["cover_image_url"],
            status="pending_review",
            accepting_orders=False,
            opening_note="Pendiente de aprobacion",
            min_delivery_minutes=20,
            max_delivery_minutes=45,
        )
        db.add(store)
        db.flush()
    else:
        store.application_id = application.id
        store.slug = build_unique_store_slug(db, application.business_name, exclude_store_id=store.id)
        store.name = application.business_name
        store.description = application.description
        store.address = application.address
        store.phone = application.phone
        store.logo_url = store.logo_url or application.logo_url or assets["logo_url"]
        store.cover_image_url = store.cover_image_url or application.cover_image_url or assets["cover_image_url"]
        store.status = "pending_review"
        store.accepting_orders = False
        store.opening_note = store.opening_note or "Pendiente de aprobacion"

    settings = store.delivery_settings
    if settings is None:
        settings = StoreDeliverySettings(
            store_id=store.id,
            delivery_enabled=True,
            pickup_enabled=True,
            delivery_fee=0,
            min_order=0,
        )
        db.add(settings)

    payment_settings = store.payment_settings
    if payment_settings is None:
        payment_settings = StorePaymentSettings(
            store_id=store.id,
            cash_enabled=True,
            mercadopago_enabled=False,
        )
        db.add(payment_settings)

    if not list(store.hours or []):
        for hour in default_hours():
            hour.store_id = store.id
            db.add(hour)

    store.category_links = [
        StoreCategoryLink(store_id=store.id, category_id=category.id, is_primary=index == 0)
        for index, category in enumerate(categories)
    ]
    return store


def build_application(
    *,
    user_id: int,
    payload: MerchantApplicationCreate,
    categories: list[Category],
) -> MerchantApplication:
    assets = resolve_store_assets(categories)
    return MerchantApplication(
        user_id=user_id,
        business_name=payload.business_name,
        description=payload.description,
        address=payload.address,
        phone=payload.phone,
        logo_url=payload.logo_url or assets["logo_url"],
        cover_image_url=payload.cover_image_url or assets["cover_image_url"],
        requested_category_ids=[category.id for category in categories],
        status="pending_review",
        review_notes="Solicitud recibida. Puedes configurar tu comercio mientras el equipo revisa la aprobacion.",
    )


@router.get("")
def list_my_applications(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[dict[str, object]]:
    applications = db.scalars(
        select(MerchantApplication)
        .options(selectinload(MerchantApplication.store))
        .where(MerchantApplication.user_id == user.id)
        .order_by(MerchantApplication.id.desc())
    ).all()
    return [serialize_application(attach_requested_categories(db, application)).model_dump() for application in applications]


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register_merchant_application(
    payload: MerchantApplicationRegister,
    db: Session = Depends(get_db),
) -> AuthResponse:
    existing_user = db.scalar(select(User).where(User.email == payload.email))
    if existing_user is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    categories = get_categories_or_400(db, list(payload.requested_category_ids or []))

    user = User(
        full_name=payload.full_name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role="merchant",
        is_active=True,
    )
    db.add(user)
    db.flush()

    application = build_application(
        user_id=user.id,
        payload=MerchantApplicationCreate(
            business_name=payload.business_name,
            description=payload.description,
            address=payload.address,
            phone=payload.phone,
            requested_category_ids=payload.requested_category_ids,
        ),
        categories=categories,
    )
    db.add(application)
    db.flush()

    ensure_pending_store(db, user=user, application=application, categories=categories)
    db.commit()
    db.refresh(user)

    return AuthResponse(
        access_token=create_access_token(user.email),
        user=UserRead.model_validate(user),
    )


@router.post("", status_code=status.HTTP_201_CREATED)
def create_application(
    payload: MerchantApplicationCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    if user.role not in {"customer", "merchant"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account cannot request merchant access")

    categories = get_categories_or_400(db, list(payload.requested_category_ids or []))

    active_application = db.scalar(
        select(MerchantApplication).where(
            MerchantApplication.user_id == user.id,
            MerchantApplication.status.in_(["pending_review", "approved", "suspended"]),
        )
    )
    if active_application is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have an active merchant application",
        )

    application = build_application(user_id=user.id, payload=payload, categories=categories)
    db.add(application)
    db.flush()

    user.role = "merchant"
    ensure_pending_store(db, user=user, application=application, categories=categories)
    db.commit()
    db.refresh(application)
    return serialize_application(attach_requested_categories(db, application)).model_dump()
