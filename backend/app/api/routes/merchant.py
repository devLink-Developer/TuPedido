from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import require_merchant
from app.api.presenters import (
    serialize_delivery_profile,
    serialize_order,
    serialize_product,
    serialize_product_category,
    serialize_store_detail,
)
from app.core.security import hash_password
from app.core.utils import slugify
from app.db.session import get_db
from app.models.delivery import DeliveryApplication, DeliveryProfile, RiderSettlementPayment
from app.models.order import StoreOrder
from app.models.store import (
    Category,
    Product,
    ProductCategory,
    ProductSubcategory,
    Store,
    StoreCategoryLink,
    StoreDeliverySettings,
    StoreHour,
    StorePaymentSettings,
)
from app.models.user import User
from app.schemas.catalog import ProductSubcategoryRead
from app.schemas.delivery import DeliveryAssignRequest
from app.schemas.merchant import (
    MercadoPagoCredentialsUpdate,
    MerchantRiderCreate,
    MerchantRiderSettlementPaymentCreate,
    MerchantRiderUpdate,
    ProductCategoryCreate,
    ProductCategoryUpdate,
    ProductSubcategoryCreate,
    ProductSubcategoryUpdate,
    ProductWrite,
    StoreCategoriesUpdate,
    StoreDeliverySettingsUpdate,
    StoreHoursUpdate,
    StorePaymentSettingsUpdate,
    StoreUpdate,
)
from app.schemas.order import OrderStatusUpdate
from app.services.delivery import (
    assign_order_to_rider,
    cancel_delivery_order,
    create_notifications,
    mark_order_ready_for_dispatch,
    publish_order_snapshot,
    rider_has_active_order,
)
from app.services.mercadopago import get_or_create_mercadopago_provider, is_store_mercadopago_ready
from app.services.settlements import create_cash_service_fee_charge
from app.services.store_address import store_has_configured_delivery_address

router = APIRouter()

STORE_OPTIONS = (
    selectinload(Store.category_links).selectinload(StoreCategoryLink.category),
    selectinload(Store.hours),
    selectinload(Store.delivery_settings),
    selectinload(Store.payment_settings),
    selectinload(Store.payment_accounts),
    selectinload(Store.product_categories).selectinload(ProductCategory.subcategories),
    selectinload(Store.products).selectinload(Product.product_category),
    selectinload(Store.products).selectinload(Product.product_subcategory),
)

ORDER_OPTIONS = (
    selectinload(StoreOrder.items),
    selectinload(StoreOrder.store),
    selectinload(StoreOrder.address),
    selectinload(StoreOrder.delivery_assignment),
)

RIDER_OPTIONS = (
    selectinload(DeliveryProfile.user),
    selectinload(DeliveryProfile.application),
    selectinload(DeliveryProfile.store),
)


def get_merchant_store(db: Session, user_id: int) -> Store:
    store = db.scalar(select(Store).options(*STORE_OPTIONS).where(Store.owner_user_id == user_id))
    if store is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Merchant store not found")
    return store


def get_merchant_rider(db: Session, *, store_id: int, rider_user_id: int) -> DeliveryProfile:
    profile = db.scalar(
        select(DeliveryProfile)
        .options(*RIDER_OPTIONS)
        .where(DeliveryProfile.user_id == rider_user_id, DeliveryProfile.store_id == store_id)
    )
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rider not found")
    return profile


@router.get("/store")
def get_store(user: User = Depends(require_merchant), db: Session = Depends(get_db)) -> dict[str, object]:
    store = get_merchant_store(db, user.id)
    mercadopago_provider = get_or_create_mercadopago_provider(db)
    return serialize_store_detail(store, mercadopago_provider=mercadopago_provider).model_dump()


@router.put("/store")
def update_store(
    payload: StoreUpdate,
    user: User = Depends(require_merchant),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    store = get_merchant_store(db, user.id)
    store.name = payload.name
    store.description = payload.description
    store.address = payload.address
    store.postal_code = payload.postal_code.strip() if payload.postal_code else None
    store.province = payload.province.strip() if payload.province else None
    store.locality = payload.locality.strip() if payload.locality else None
    store.phone = payload.phone
    store.latitude = payload.latitude
    store.longitude = payload.longitude
    store.logo_url = payload.logo_url
    store.cover_image_url = payload.cover_image_url
    store.accepting_orders = payload.accepting_orders if store.status == "approved" else False
    store.opening_note = payload.opening_note
    store.min_delivery_minutes = payload.min_delivery_minutes
    store.max_delivery_minutes = payload.max_delivery_minutes
    if store.delivery_settings and not store_has_configured_delivery_address(store):
        store.delivery_settings.delivery_enabled = False
    db.commit()
    db.refresh(store)
    mercadopago_provider = get_or_create_mercadopago_provider(db)
    return serialize_store_detail(store, mercadopago_provider=mercadopago_provider).model_dump()


@router.put("/store/categories")
def update_store_categories(
    payload: StoreCategoriesUpdate,
    user: User = Depends(require_merchant),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    store = get_merchant_store(db, user.id)
    categories = db.scalars(
        select(Category).where(Category.id.in_(payload.category_ids), Category.is_active.is_(True))
    ).all()
    if len(categories) != len(payload.category_ids):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown category ids")
    store.category_links = [
        StoreCategoryLink(store_id=store.id, category_id=category.id, is_primary=index == 0)
        for index, category in enumerate(categories)
    ]
    db.commit()
    db.refresh(store)
    mercadopago_provider = get_or_create_mercadopago_provider(db)
    return serialize_store_detail(store, mercadopago_provider=mercadopago_provider).model_dump()


@router.put("/store/hours")
def update_store_hours(
    payload: StoreHoursUpdate,
    user: User = Depends(require_merchant),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    store = get_merchant_store(db, user.id)
    store.hours = [
        StoreHour(
            store_id=store.id,
            day_of_week=item.day_of_week,
            opens_at=item.opens_at,
            closes_at=item.closes_at,
            is_closed=item.is_closed,
        )
        for item in payload.hours
    ]
    db.commit()
    db.refresh(store)
    mercadopago_provider = get_or_create_mercadopago_provider(db)
    return serialize_store_detail(store, mercadopago_provider=mercadopago_provider).model_dump()


@router.put("/store/delivery-settings")
def update_delivery_settings(
    payload: StoreDeliverySettingsUpdate,
    user: User = Depends(require_merchant),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    store = get_merchant_store(db, user.id)
    if payload.delivery_enabled and not store_has_configured_delivery_address(store):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Configura la direccion exacta del comercio con CP, localidad y geolocalizacion antes de habilitar delivery.",
        )
    settings = store.delivery_settings
    if settings is None:
        settings = StoreDeliverySettings(store_id=store.id)
        db.add(settings)
    settings.delivery_enabled = payload.delivery_enabled
    settings.pickup_enabled = payload.pickup_enabled
    settings.delivery_fee = payload.delivery_fee
    settings.free_delivery_min_order = payload.free_delivery_min_order
    settings.rider_fee = payload.rider_fee
    settings.min_order = payload.min_order
    db.commit()
    db.refresh(store)
    mercadopago_provider = get_or_create_mercadopago_provider(db)
    return serialize_store_detail(store, mercadopago_provider=mercadopago_provider).model_dump()


@router.put("/store/payment-settings")
def update_payment_settings(
    payload: StorePaymentSettingsUpdate,
    user: User = Depends(require_merchant),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    store = get_merchant_store(db, user.id)
    mercadopago_provider = get_or_create_mercadopago_provider(db)
    settings = store.payment_settings
    if settings is None:
        settings = StorePaymentSettings(store_id=store.id)
        db.add(settings)
    if payload.mercadopago_enabled:
        if not mercadopago_provider.enabled:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Mercado Pago is disabled by the platform configuration",
            )
        if not is_store_mercadopago_ready(store, provider=mercadopago_provider):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Connect your Mercado Pago account before enabling this payment method",
            )
    settings.cash_enabled = payload.cash_enabled
    settings.mercadopago_enabled = payload.mercadopago_enabled
    db.commit()
    db.refresh(store)
    return serialize_store_detail(store, mercadopago_provider=mercadopago_provider).model_dump()


@router.get("/riders")
def list_riders(user: User = Depends(require_merchant), db: Session = Depends(get_db)) -> list[dict[str, object]]:
    store = get_merchant_store(db, user.id)
    riders = db.scalars(
        select(DeliveryProfile)
        .options(*RIDER_OPTIONS)
        .where(DeliveryProfile.store_id == store.id)
        .order_by(DeliveryProfile.is_active.desc(), DeliveryProfile.user_id.asc())
    ).all()
    return [serialize_delivery_profile(rider).model_dump() for rider in riders]


@router.post("/riders", status_code=status.HTTP_201_CREATED)
def create_rider(
    payload: MerchantRiderCreate,
    merchant: User = Depends(require_merchant),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    store = get_merchant_store(db, merchant.id)
    existing_user = db.scalar(select(User).where(User.email == payload.email))
    if existing_user is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    if payload.vehicle_type in {"motorcycle", "car"} and (not payload.license_number or not payload.vehicle_plate):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="License number and vehicle plate are required for motor vehicles",
        )

    rider_user = User(
        full_name=payload.full_name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role="delivery",
        is_active=True,
    )
    db.add(rider_user)
    db.flush()

    application = DeliveryApplication(
        user_id=rider_user.id,
        store_id=store.id,
        phone=payload.phone,
        vehicle_type=payload.vehicle_type,
        photo_url=payload.photo_url,
        dni_number=payload.dni_number,
        emergency_contact_name=payload.emergency_contact_name,
        emergency_contact_phone=payload.emergency_contact_phone,
        license_number=payload.license_number,
        vehicle_plate=payload.vehicle_plate,
        insurance_policy=payload.insurance_policy,
        notes=payload.notes,
        status="approved",
        review_notes="Alta directa por comercio",
        reviewed_by_user_id=merchant.id,
        reviewed_at=datetime.now(UTC),
    )
    db.add(application)
    db.flush()

    profile = DeliveryProfile(
        user_id=rider_user.id,
        application_id=application.id,
        store_id=store.id,
        phone=payload.phone,
        vehicle_type=payload.vehicle_type,
        photo_url=payload.photo_url,
        dni_number=payload.dni_number,
        emergency_contact_name=payload.emergency_contact_name,
        emergency_contact_phone=payload.emergency_contact_phone,
        license_number=payload.license_number,
        vehicle_plate=payload.vehicle_plate,
        insurance_policy=payload.insurance_policy,
        availability="offline",
        is_active=True,
        approved_by_user_id=merchant.id,
        approved_at=datetime.now(UTC),
    )
    db.add(profile)

    db.commit()
    created_profile = db.scalar(
        select(DeliveryProfile).options(*RIDER_OPTIONS).where(DeliveryProfile.user_id == rider_user.id)
    )
    assert created_profile is not None
    return serialize_delivery_profile(created_profile).model_dump()


@router.get("/riders/settlements")
def list_rider_settlements(
    merchant: User = Depends(require_merchant),
    db: Session = Depends(get_db),
) -> list[dict[str, object]]:
    store = get_merchant_store(db, merchant.id)
    riders = db.scalars(
        select(DeliveryProfile)
        .options(*RIDER_OPTIONS)
        .where(DeliveryProfile.store_id == store.id)
        .order_by(DeliveryProfile.user_id.asc())
    ).all()

    results: list[dict[str, object]] = []
    for rider in riders:
        rider_fee_earned_total = db.scalar(
            select(func.coalesce(func.sum(StoreOrder.rider_fee), 0)).where(
                StoreOrder.store_id == store.id,
                StoreOrder.assigned_rider_id == rider.user_id,
                StoreOrder.status == "delivered",
            )
        )
        rider_fee_paid_total = db.scalar(
            select(func.coalesce(func.sum(RiderSettlementPayment.amount), 0)).where(
                RiderSettlementPayment.store_id == store.id,
                RiderSettlementPayment.rider_user_id == rider.user_id,
            )
        )
        earned = float(rider_fee_earned_total or 0)
        paid = float(rider_fee_paid_total or 0)
        results.append(
            {
                "rider_user_id": rider.user_id,
                "rider_name": rider.user.full_name,
                "vehicle_type": rider.vehicle_type,
                "cash_liability_total": 0.0,
                "cash_liability_open": 0.0,
                "rider_fee_earned_total": earned,
                "rider_fee_paid_total": paid,
                "pending_amount": max(0.0, earned - paid),
                "merchant_cash_payable_total": 0.0,
            }
        )
    return results


@router.post("/riders/settlements/payments", status_code=status.HTTP_201_CREATED)
def create_rider_settlement_payment(
    payload: MerchantRiderSettlementPaymentCreate,
    merchant: User = Depends(require_merchant),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    store = get_merchant_store(db, merchant.id)
    rider = get_merchant_rider(db, store_id=store.id, rider_user_id=payload.rider_user_id)
    payment = RiderSettlementPayment(
        rider_user_id=rider.user_id,
        store_id=store.id,
        source="merchant_manual",
        amount=payload.amount,
        paid_at=payload.paid_at,
        reference=payload.reference,
        notes=payload.notes,
        created_by_user_id=merchant.id,
    )
    db.add(payment)
    create_notifications(
        db,
        user_ids=[rider.user_id],
        order_id=None,
        event_type="delivery.settlement_paid",
        title="Pago registrado",
        body=f"{store.name} registró un pago por ${payload.amount:.2f}.",
        payload={"amount": payload.amount},
    )
    db.flush()
    db.commit()
    db.refresh(payment)
    return {
        "id": payment.id,
        "rider_user_id": payment.rider_user_id,
        "store_id": payment.store_id,
        "amount": float(payment.amount),
        "paid_at": payment.paid_at.isoformat(),
        "reference": payment.reference,
        "notes": payment.notes,
    }


@router.put("/riders/{rider_user_id}")
def update_rider(
    rider_user_id: int,
    payload: MerchantRiderUpdate,
    merchant: User = Depends(require_merchant),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    store = get_merchant_store(db, merchant.id)
    if payload.vehicle_type in {"motorcycle", "car"} and (not payload.license_number or not payload.vehicle_plate):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="License number and vehicle plate are required for motor vehicles",
        )
    profile = get_merchant_rider(db, store_id=store.id, rider_user_id=rider_user_id)
    if not payload.is_active and rider_has_active_order(db, rider_user_id=profile.user_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot deactivate a rider with an active delivery",
        )

    profile.user.full_name = payload.full_name
    profile.phone = payload.phone
    profile.vehicle_type = payload.vehicle_type
    profile.photo_url = payload.photo_url
    profile.dni_number = payload.dni_number
    profile.emergency_contact_name = payload.emergency_contact_name
    profile.emergency_contact_phone = payload.emergency_contact_phone
    profile.license_number = payload.license_number
    profile.vehicle_plate = payload.vehicle_plate
    profile.insurance_policy = payload.insurance_policy
    profile.is_active = payload.is_active
    if not payload.is_active:
        profile.availability = "offline"

    application = db.scalar(select(DeliveryApplication).where(DeliveryApplication.id == profile.application_id))
    if application is not None:
        application.store_id = store.id
        application.phone = payload.phone
        application.vehicle_type = payload.vehicle_type
        application.photo_url = payload.photo_url
        application.dni_number = payload.dni_number
        application.emergency_contact_name = payload.emergency_contact_name
        application.emergency_contact_phone = payload.emergency_contact_phone
        application.license_number = payload.license_number
        application.vehicle_plate = payload.vehicle_plate
        application.insurance_policy = payload.insurance_policy
        application.notes = payload.notes

    db.commit()
    refreshed = db.scalar(
        select(DeliveryProfile).options(*RIDER_OPTIONS).where(DeliveryProfile.user_id == rider_user_id)
    )
    assert refreshed is not None
    return serialize_delivery_profile(refreshed).model_dump()


@router.post("/orders/{order_id}/assign-rider")
def assign_rider_to_order(
    order_id: int,
    payload: DeliveryAssignRequest,
    merchant: User = Depends(require_merchant),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    store = get_merchant_store(db, merchant.id)
    order = db.scalar(select(StoreOrder).options(*ORDER_OPTIONS).where(StoreOrder.id == order_id, StoreOrder.store_id == store.id))
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    rider_user = db.scalar(
        select(User).where(User.id == payload.rider_user_id, User.role == "delivery", User.is_active.is_(True))
    )
    if rider_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rider not found")

    try:
        assign_order_to_rider(db, order=order, rider=rider_user)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    db.commit()
    db.refresh(order)
    publish_order_snapshot(order, event_type="delivery.assigned")
    return serialize_order(order).model_dump()


@router.put("/store/mercadopago-credentials")
def update_mercadopago_credentials(
    payload: MercadoPagoCredentialsUpdate,
    user: User = Depends(require_merchant),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="Manual Mercado Pago credentials are no longer supported. Connect your Mercado Pago account via OAuth.",
    )


@router.get("/product-categories")
def list_product_categories(
    user: User = Depends(require_merchant), db: Session = Depends(get_db)
) -> list[dict[str, object]]:
    store = get_merchant_store(db, user.id)
    return [serialize_product_category(item).model_dump() for item in store.product_categories]


@router.post("/product-categories", status_code=status.HTTP_201_CREATED)
def create_product_category(
    payload: ProductCategoryCreate,
    user: User = Depends(require_merchant),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    store = get_merchant_store(db, user.id)
    existing = db.scalar(
        select(ProductCategory).where(
            ProductCategory.store_id == store.id,
            ProductCategory.slug == slugify(payload.name),
        )
    )
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Product category already exists")
    category = ProductCategory(
        store_id=store.id,
        name=payload.name,
        slug=slugify(payload.name),
        sort_order=payload.sort_order,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return serialize_product_category(category).model_dump()


@router.put("/product-categories/{category_id}")
def update_product_category(
    category_id: int,
    payload: ProductCategoryUpdate,
    user: User = Depends(require_merchant),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    store = get_merchant_store(db, user.id)
    category = db.scalar(
        select(ProductCategory).where(ProductCategory.id == category_id, ProductCategory.store_id == store.id)
    )
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product category not found")
    existing = db.scalar(
        select(ProductCategory).where(
            ProductCategory.store_id == store.id,
            ProductCategory.slug == slugify(payload.name),
            ProductCategory.id != category_id,
        )
    )
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Product category already exists")
    category.name = payload.name
    category.slug = slugify(payload.name)
    category.sort_order = payload.sort_order
    db.commit()
    db.refresh(category)
    return serialize_product_category(category).model_dump()


@router.delete("/product-categories/{category_id}")
def delete_product_category(
    category_id: int,
    user: User = Depends(require_merchant),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    store = get_merchant_store(db, user.id)
    category = db.scalar(
        select(ProductCategory).where(ProductCategory.id == category_id, ProductCategory.store_id == store.id)
    )
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product category not found")
    db.delete(category)
    db.commit()
    return {"status": "deleted"}


@router.post("/product-subcategories", status_code=status.HTTP_201_CREATED)
def create_product_subcategory(
    payload: ProductSubcategoryCreate,
    user: User = Depends(require_merchant),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    store = get_merchant_store(db, user.id)
    category = db.scalar(
        select(ProductCategory).where(
            ProductCategory.id == payload.product_category_id,
            ProductCategory.store_id == store.id,
        )
    )
    if category is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid product category")
    existing = db.scalar(
        select(ProductSubcategory).where(
            ProductSubcategory.product_category_id == category.id,
            ProductSubcategory.slug == slugify(payload.name),
        )
    )
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Product subcategory already exists")
    subcategory = ProductSubcategory(
        product_category_id=category.id,
        name=payload.name,
        slug=slugify(payload.name),
        sort_order=payload.sort_order,
    )
    db.add(subcategory)
    db.commit()
    db.refresh(subcategory)
    return ProductSubcategoryRead(
        id=subcategory.id,
        product_category_id=subcategory.product_category_id,
        name=subcategory.name,
        slug=subcategory.slug,
        sort_order=subcategory.sort_order,
    ).model_dump()


@router.put("/product-subcategories/{subcategory_id}")
def update_product_subcategory(
    subcategory_id: int,
    payload: ProductSubcategoryUpdate,
    user: User = Depends(require_merchant),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    store = get_merchant_store(db, user.id)
    subcategory = db.scalar(
        select(ProductSubcategory)
        .join(ProductSubcategory.product_category)
        .where(ProductSubcategory.id == subcategory_id, ProductCategory.store_id == store.id)
    )
    if subcategory is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product subcategory not found")
    category = db.scalar(
        select(ProductCategory).where(
            ProductCategory.id == payload.product_category_id,
            ProductCategory.store_id == store.id,
        )
    )
    if category is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid product category")
    existing = db.scalar(
        select(ProductSubcategory).where(
            ProductSubcategory.product_category_id == category.id,
            ProductSubcategory.slug == slugify(payload.name),
            ProductSubcategory.id != subcategory_id,
        )
    )
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Product subcategory already exists")
    subcategory.product_category_id = category.id
    subcategory.name = payload.name
    subcategory.slug = slugify(payload.name)
    subcategory.sort_order = payload.sort_order
    db.commit()
    db.refresh(subcategory)
    return ProductSubcategoryRead(
        id=subcategory.id,
        product_category_id=subcategory.product_category_id,
        name=subcategory.name,
        slug=subcategory.slug,
        sort_order=subcategory.sort_order,
    ).model_dump()


@router.delete("/product-subcategories/{subcategory_id}")
def delete_product_subcategory(
    subcategory_id: int,
    user: User = Depends(require_merchant),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    store = get_merchant_store(db, user.id)
    subcategory = db.scalar(
        select(ProductSubcategory)
        .join(ProductSubcategory.product_category)
        .where(ProductSubcategory.id == subcategory_id, ProductCategory.store_id == store.id)
    )
    if subcategory is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product subcategory not found")
    db.delete(subcategory)
    db.commit()
    return {"status": "deleted"}


@router.get("/products")
def list_products(user: User = Depends(require_merchant), db: Session = Depends(get_db)) -> list[dict[str, object]]:
    store = get_merchant_store(db, user.id)
    return [serialize_product(item).model_dump() for item in store.products]


@router.post("/products", status_code=status.HTTP_201_CREATED)
def create_product(
    payload: ProductWrite,
    user: User = Depends(require_merchant),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    store = get_merchant_store(db, user.id)
    existing_sku = db.scalar(select(Product).where(Product.store_id == store.id, Product.sku == payload.sku))
    if existing_sku is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="SKU already exists in this store")
    if payload.product_category_id is not None:
        category = db.scalar(
            select(ProductCategory).where(
                ProductCategory.id == payload.product_category_id,
                ProductCategory.store_id == store.id,
            )
        )
        if category is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid product category")
    if payload.product_subcategory_id is not None:
        if payload.product_category_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Product category is required when a subcategory is selected",
            )
        subcategory = db.scalar(
            select(ProductSubcategory)
            .join(ProductSubcategory.product_category)
            .where(
                ProductSubcategory.id == payload.product_subcategory_id,
                ProductSubcategory.product_category_id == payload.product_category_id,
                ProductCategory.store_id == store.id,
            )
        )
        if subcategory is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid product subcategory")
    if payload.commercial_discount_type == "percentage" and (payload.commercial_discount_value or 0) > 100:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Percentage discount cannot exceed 100")
    if payload.commercial_discount_type == "fixed" and (payload.commercial_discount_value or 0) > payload.price:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Fixed discount cannot exceed product price")
    product = Product(store_id=store.id, **payload.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return serialize_product(product).model_dump()


@router.put("/products/{product_id}")
def update_product(
    product_id: int,
    payload: ProductWrite,
    user: User = Depends(require_merchant),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    store = get_merchant_store(db, user.id)
    product = db.scalar(select(Product).where(Product.id == product_id, Product.store_id == store.id))
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    if payload.product_category_id is not None:
        category = db.scalar(
            select(ProductCategory).where(
                ProductCategory.id == payload.product_category_id,
                ProductCategory.store_id == store.id,
            )
        )
        if category is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid product category")
    if payload.product_subcategory_id is not None:
        if payload.product_category_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Product category is required when a subcategory is selected",
            )
        subcategory = db.scalar(
            select(ProductSubcategory)
            .join(ProductSubcategory.product_category)
            .where(
                ProductSubcategory.id == payload.product_subcategory_id,
                ProductSubcategory.product_category_id == payload.product_category_id,
                ProductCategory.store_id == store.id,
            )
        )
        if subcategory is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid product subcategory")
    existing_sku = db.scalar(
        select(Product).where(Product.store_id == store.id, Product.sku == payload.sku, Product.id != product_id)
    )
    if existing_sku is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="SKU already exists in this store")
    if payload.commercial_discount_type == "percentage" and (payload.commercial_discount_value or 0) > 100:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Percentage discount cannot exceed 100")
    if payload.commercial_discount_type == "fixed" and (payload.commercial_discount_value or 0) > payload.price:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Fixed discount cannot exceed product price")
    for field, value in payload.model_dump().items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return serialize_product(product).model_dump()


@router.delete("/products/{product_id}")
def delete_product(
    product_id: int,
    user: User = Depends(require_merchant),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    store = get_merchant_store(db, user.id)
    product = db.scalar(select(Product).where(Product.id == product_id, Product.store_id == store.id))
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    db.delete(product)
    db.commit()
    return {"status": "deleted"}


@router.get("/orders")
def list_orders(user: User = Depends(require_merchant), db: Session = Depends(get_db)) -> list[dict[str, object]]:
    store = get_merchant_store(db, user.id)
    orders = db.scalars(
        select(StoreOrder)
        .options(*ORDER_OPTIONS)
        .where(StoreOrder.store_id == store.id)
        .order_by(StoreOrder.id.desc())
    ).all()
    return [serialize_order(order).model_dump() for order in orders]


@router.put("/orders/{order_id}/status")
def update_order_status(
    order_id: int,
    payload: OrderStatusUpdate,
    user: User = Depends(require_merchant),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    store = get_merchant_store(db, user.id)
    order = db.scalar(
        select(StoreOrder)
        .options(*ORDER_OPTIONS)
        .where(StoreOrder.id == order_id, StoreOrder.store_id == store.id)
    )
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    previous_status = order.status
    allowed_statuses = (
        {"preparing", "ready_for_dispatch", "cancelled"}
        if order.delivery_mode == "delivery"
        else {"preparing", "ready_for_pickup", "delivered", "cancelled"}
    )
    if payload.status not in allowed_statuses:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Merchant can only move orders to preparing, ready_for_dispatch or cancelled",
        )
    if order.delivery_provider == "platform" and payload.status in {"out_for_delivery", "delivered"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Platform delivery orders must be moved by the assigned rider",
        )
    if payload.status == "preparing":
        if order.payment_method == "mercadopago" and order.payment_status != "approved":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Mercado Pago orders must be approved before they can be accepted",
            )
        if order.status not in {"created", "accepted", "preparing"}:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Order cannot be moved to preparing")
        order.status = "preparing"
    elif payload.status == "ready_for_dispatch":
        if order.status != "preparing":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Order must be preparing before it is marked ready for dispatch",
            )
        mark_order_ready_for_dispatch(db, order)
    elif payload.status == "ready_for_pickup":
        if order.delivery_mode != "pickup":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only pickup orders use ready_for_pickup")
        if order.status != "preparing":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Order must be preparing before it is marked ready for pickup",
            )
        order.status = "ready_for_pickup"
    elif payload.status == "delivered":
        if order.delivery_mode != "pickup":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Delivery orders are closed by the rider")
        order.status = "delivered"
        order.delivered_at = datetime.now(UTC)
        if previous_status != "delivered":
            create_cash_service_fee_charge(db, order)
    elif payload.status == "cancelled":
        if order.status in {"delivered", "cancelled", "delivery_failed"}:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Order is already closed")
        if order.delivery_status in {"picked_up", "near_customer", "delivered"}:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Order cannot be cancelled after pickup",
            )
        cancel_delivery_order(db, order=order, reason=f"{store.name} canceló el pedido.")
    else:
        order.status = payload.status
    db.commit()
    db.refresh(order)
    publish_order_snapshot(order, event_type="order.updated")
    return serialize_order(order).model_dump()
