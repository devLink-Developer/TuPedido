from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import require_merchant
from app.api.presenters import serialize_order, serialize_product, serialize_product_category, serialize_store_detail
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
from app.models.user import User
from app.schemas.merchant import (
    MercadoPagoCredentialsUpdate,
    ProductCategoryCreate,
    ProductCategoryUpdate,
    ProductWrite,
    StoreCategoriesUpdate,
    StoreDeliverySettingsUpdate,
    StoreHoursUpdate,
    StorePaymentSettingsUpdate,
    StoreUpdate,
)
from app.schemas.order import OrderStatusUpdate
from app.services.settlements import create_cash_service_fee_charge
from app.services.delivery import mark_order_ready_for_dispatch, publish_order_snapshot

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


def get_merchant_store(db: Session, user_id: int) -> Store:
    store = db.scalar(select(Store).options(*STORE_OPTIONS).where(Store.owner_user_id == user_id))
    if store is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Merchant store not found")
    return store


@router.get("/store")
def get_store(user: User = Depends(require_merchant), db: Session = Depends(get_db)) -> dict[str, object]:
    store = get_merchant_store(db, user.id)
    return serialize_store_detail(store).model_dump()


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
    store.phone = payload.phone
    store.latitude = payload.latitude
    store.longitude = payload.longitude
    store.logo_url = payload.logo_url
    store.cover_image_url = payload.cover_image_url
    store.accepting_orders = payload.accepting_orders if store.status == "approved" else False
    store.opening_note = payload.opening_note
    store.min_delivery_minutes = payload.min_delivery_minutes
    store.max_delivery_minutes = payload.max_delivery_minutes
    db.commit()
    db.refresh(store)
    return serialize_store_detail(store).model_dump()


@router.put("/store/categories")
def update_store_categories(
    payload: StoreCategoriesUpdate,
    user: User = Depends(require_merchant),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    store = get_merchant_store(db, user.id)
    categories = db.scalars(select(Category).where(Category.id.in_(payload.category_ids))).all()
    if len(categories) != len(payload.category_ids):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown category ids")
    store.category_links = [
        StoreCategoryLink(store_id=store.id, category_id=category.id, is_primary=index == 0)
        for index, category in enumerate(categories)
    ]
    db.commit()
    db.refresh(store)
    return serialize_store_detail(store).model_dump()


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
    return serialize_store_detail(store).model_dump()


@router.put("/store/delivery-settings")
def update_delivery_settings(
    payload: StoreDeliverySettingsUpdate,
    user: User = Depends(require_merchant),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    store = get_merchant_store(db, user.id)
    settings = store.delivery_settings
    if settings is None:
        settings = StoreDeliverySettings(store_id=store.id)
        db.add(settings)
    settings.delivery_enabled = payload.delivery_enabled
    settings.pickup_enabled = payload.pickup_enabled
    settings.delivery_fee = payload.delivery_fee
    settings.min_order = payload.min_order
    db.commit()
    db.refresh(store)
    return serialize_store_detail(store).model_dump()


@router.put("/store/payment-settings")
def update_payment_settings(
    payload: StorePaymentSettingsUpdate,
    user: User = Depends(require_merchant),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    store = get_merchant_store(db, user.id)
    settings = store.payment_settings
    if settings is None:
        settings = StorePaymentSettings(store_id=store.id)
        db.add(settings)
    settings.cash_enabled = payload.cash_enabled
    settings.mercadopago_enabled = payload.mercadopago_enabled
    db.commit()
    db.refresh(store)
    return serialize_store_detail(store).model_dump()


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
    category.name = payload.name
    category.slug = slugify(payload.name)
    category.sort_order = payload.sort_order
    db.commit()
    db.refresh(category)
    return serialize_product_category(category).model_dump()


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
    if payload.product_category_id is not None:
        category = db.scalar(
            select(ProductCategory).where(
                ProductCategory.id == payload.product_category_id,
                ProductCategory.store_id == store.id,
            )
        )
        if category is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid product category")
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
        .options(
            selectinload(StoreOrder.items),
            selectinload(StoreOrder.store),
            selectinload(StoreOrder.address),
            selectinload(StoreOrder.delivery_assignment),
        )
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
        .options(
            selectinload(StoreOrder.items),
            selectinload(StoreOrder.store),
            selectinload(StoreOrder.address),
            selectinload(StoreOrder.delivery_assignment),
        )
        .where(StoreOrder.id == order_id, StoreOrder.store_id == store.id)
    )
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    previous_status = order.status
    if order.delivery_provider == "platform" and payload.status in {"out_for_delivery", "delivered"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Platform delivery orders must be moved by the assigned rider",
        )
    if payload.status == "ready_for_dispatch":
        mark_order_ready_for_dispatch(db, order)
    else:
        order.status = payload.status
    if previous_status != "delivered" and payload.status == "delivered":
        create_cash_service_fee_charge(db, order)
    db.commit()
    db.refresh(order)
    publish_order_snapshot(order, event_type="order.updated")
    return serialize_order(order).model_dump()
