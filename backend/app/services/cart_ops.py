from __future__ import annotations

from sqlalchemy import select, text
from sqlalchemy.orm import Session, object_session, selectinload

from fastapi import HTTPException, status

from app.core.utils import is_store_open
from app.models.delivery import DeliveryProfile
from app.models.order import ShoppingCart, ShoppingCartItem, StoreOrder
from app.models.store import Product, Store, StoreCategoryLink
from app.services.delivery import customer_delivery_fee_for_store
from app.services.platform import get_service_fee_amount
from app.services.promotions import applied_promotions_discount_total, calculate_applied_promotions
from app.services.product_pricing import compute_discount_amount, compute_final_price
from app.services.mercadopago import is_store_mercadopago_ready
from app.services.store_address import store_can_receive_orders_by_configuration, store_delivery_is_enabled, store_pickup_is_enabled
from app.services.store_coverage import has_valid_coordinates, store_covers_location

STORE_OPTIONS = (
    selectinload(Store.category_links).selectinload(StoreCategoryLink.category),
    selectinload(Store.hours),
    selectinload(Store.delivery_settings),
    selectinload(Store.delivery_riders).selectinload(DeliveryProfile.user),
    selectinload(Store.payment_settings),
    selectinload(Store.payment_accounts),
    selectinload(Store.products),
)

CART_OPTIONS = (
    selectinload(ShoppingCart.store).selectinload(Store.category_links).selectinload(StoreCategoryLink.category),
    selectinload(ShoppingCart.store).selectinload(Store.hours),
    selectinload(ShoppingCart.store).selectinload(Store.delivery_settings),
    selectinload(ShoppingCart.store).selectinload(Store.delivery_riders).selectinload(DeliveryProfile.user),
    selectinload(ShoppingCart.store).selectinload(Store.payment_settings),
    selectinload(ShoppingCart.store).selectinload(Store.payment_accounts),
    selectinload(ShoppingCart.store).selectinload(Store.products),
    selectinload(ShoppingCart.items).selectinload(ShoppingCartItem.product),
)

CART_ADVISORY_LOCK_NAMESPACE = 90216017


def _lock_user_cart(db: Session, user_id: int) -> None:
    if db.get_bind().dialect.name != "postgresql":
        return
    db.execute(
        text("SELECT pg_advisory_xact_lock(CAST(:namespace AS integer), CAST(:user_id AS integer))"),
        {"namespace": CART_ADVISORY_LOCK_NAMESPACE, "user_id": int(user_id)},
    )


def load_store(db: Session, store_id: int) -> Store | None:
    return db.scalar(select(Store).options(*STORE_OPTIONS).where(Store.id == store_id))


def load_product(db: Session, product_id: int) -> Product | None:
    return db.scalar(select(Product).where(Product.id == product_id))


def load_cart_for_user(db: Session, user_id: int, *, for_update: bool = False) -> ShoppingCart | None:
    query = (
        select(ShoppingCart)
        .options(*CART_OPTIONS)
        .execution_options(populate_existing=True)
        .where(ShoppingCart.user_id == user_id)
    )
    if for_update:
        query = query.with_for_update(of=ShoppingCart)
    return db.scalar(query)


def get_or_create_cart(db: Session, user_id: int, *, for_update: bool = False) -> ShoppingCart:
    if for_update:
        _lock_user_cart(db, user_id)
    cart = load_cart_for_user(db, user_id, for_update=for_update)
    if cart is None:
        cart = ShoppingCart(user_id=user_id, subtotal=0, delivery_fee=0, total=0)
        db.add(cart)
        db.flush()
        db.refresh(cart)
        query = (
            select(ShoppingCart)
            .options(*CART_OPTIONS)
            .execution_options(populate_existing=True)
            .where(ShoppingCart.id == cart.id)
        )
        if for_update:
            query = query.with_for_update(of=ShoppingCart)
        cart = db.scalar(query)
    return cart


def reload_cart(db: Session, cart_id: int) -> ShoppingCart:
    db.expire_all()
    cart = db.scalar(
        select(ShoppingCart)
        .options(*CART_OPTIONS)
        .execution_options(populate_existing=True)
        .where(ShoppingCart.id == cart_id)
    )
    if cart is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cart not found")
    return cart


def compute_cart_totals(cart: ShoppingCart) -> None:
    if cart.store:
        cart.delivery_mode = resolve_supported_delivery_mode(cart.store, cart.delivery_mode)
    subtotal = sum(float(getattr(item, "base_unit_price_snapshot", item.unit_price_snapshot)) * item.quantity for item in cart.items)
    commercial_discount_total = sum(
        float(getattr(item, "commercial_discount_amount_snapshot", 0) or 0) * item.quantity for item in cart.items
    )
    final_items_total = sum(float(item.unit_price_snapshot) * item.quantity for item in cart.items)
    applied_promotions = calculate_applied_promotions(object_session(cart), cart) if object_session(cart) is not None else []
    cart.subtotal = subtotal
    cart.commercial_discount_total = commercial_discount_total
    cart.financial_discount_total = applied_promotions_discount_total(applied_promotions)
    discounted_subtotal = max(0.0, final_items_total - float(cart.financial_discount_total or 0))
    delivery_fee = 0.0
    service_fee = 0.0
    if cart.store and final_items_total > 0 and cart.delivery_mode == "delivery":
        settings = cart.store.delivery_settings
        if settings and store_delivery_is_enabled(cart.store):
            delivery_fee = customer_delivery_fee_for_store(cart.store, discounted_subtotal=discounted_subtotal)
    if final_items_total > 0:
        service_fee_base = discounted_subtotal + delivery_fee
        service_fee = get_service_fee_amount(object_session(cart), fee_base_amount=service_fee_base)
    cart.delivery_fee = delivery_fee
    cart.service_fee = service_fee
    cart.total = max(0.0, final_items_total - float(cart.financial_discount_total or 0)) + delivery_fee + service_fee
    setattr(cart, "applied_promotions", applied_promotions)


def clear_cart(db: Session, cart: ShoppingCart) -> None:
    for item in list(cart.items):
        db.delete(item)
    cart.store_id = None
    cart.store = None
    cart.delivery_mode = "delivery"
    cart.subtotal = 0
    cart.commercial_discount_total = 0
    cart.financial_discount_total = 0
    cart.delivery_fee = 0
    cart.service_fee = 0
    cart.total = 0


def clear_cart_if_matches_order(db: Session, order: StoreOrder) -> bool:
    cart = db.scalar(
        select(ShoppingCart)
        .options(selectinload(ShoppingCart.items))
        .where(ShoppingCart.user_id == order.user_id)
        .with_for_update(of=ShoppingCart)
    )
    if cart is None or cart.store_id != order.store_id or cart.delivery_mode != order.delivery_mode:
        return False

    cart_items = sorted(
        (
            int(item.product_id),
            int(item.quantity),
            (item.note or "").strip(),
        )
        for item in cart.items
    )
    order_items = sorted(
        (
            int(item.product_id),
            int(item.quantity),
            (item.note or "").strip(),
        )
        for item in order.items
        if item.product_id is not None
    )
    if not cart_items or cart_items != order_items:
        return False

    clear_cart(db, cart)
    return True


def build_product_pricing_snapshot(product: Product) -> dict[str, float]:
    base_unit_price = float(product.price)
    commercial_discount_amount = compute_discount_amount(
        price=base_unit_price,
        commercial_discount_type=getattr(product, "commercial_discount_type", None),
        commercial_discount_value=float(product.commercial_discount_value)
        if getattr(product, "commercial_discount_value", None) is not None
        else None,
    )
    unit_price = compute_final_price(
        price=base_unit_price,
        commercial_discount_type=getattr(product, "commercial_discount_type", None),
        commercial_discount_value=float(product.commercial_discount_value)
        if getattr(product, "commercial_discount_value", None) is not None
        else None,
    )
    return {
        "base_unit_price": base_unit_price,
        "unit_price": unit_price,
        "commercial_discount_amount": commercial_discount_amount,
    }


def ensure_product_can_be_added(product: Product, quantity: int, *, existing_quantity: int = 0) -> None:
    if quantity <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Quantity must be greater than zero")
    max_per_order = getattr(product, "max_per_order", None)
    if max_per_order is not None and quantity + existing_quantity > max_per_order:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Maximum allowed quantity for this product is {max_per_order}",
        )
    stock_quantity = getattr(product, "stock_quantity", None)
    if stock_quantity is not None and quantity + existing_quantity > stock_quantity:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Only {stock_quantity} units are available for this product",
        )


def ensure_store_can_accept_orders(store: Store) -> None:
    if store.status != "approved":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Store is not approved")
    if not store.accepting_orders:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Store is not accepting orders")
    if not store_can_receive_orders_by_configuration(store):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Store delivery areas are not configured")
    if not is_store_open(store):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Store is closed")


def ensure_delivery_mode_supported(
    store: Store,
    delivery_mode: str,
    *,
    customer_latitude: float | None = None,
    customer_longitude: float | None = None,
) -> None:
    settings = store.delivery_settings
    if settings is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Store delivery settings are not configured")

    if delivery_mode == "delivery" and not store_delivery_is_enabled(store):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Delivery is not available for this store")
    if delivery_mode == "pickup" and not store_pickup_is_enabled(store):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Pickup is not available for this store")
    if delivery_mode not in {"delivery", "pickup"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid delivery mode")

    if not has_valid_coordinates(customer_latitude, customer_longitude):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Customer location is required for this store")

    assert customer_latitude is not None
    assert customer_longitude is not None
    if not store_covers_location(
        store,
        delivery_mode,  # type: ignore[arg-type]
        latitude=float(customer_latitude),
        longitude=float(customer_longitude),
    ):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Customer location is outside this store coverage area")


def resolve_supported_delivery_mode(store: Store, delivery_mode: str) -> str:
    delivery_enabled = store_delivery_is_enabled(store)
    pickup_enabled = store_pickup_is_enabled(store)

    if delivery_mode == "delivery" and delivery_enabled:
        return "delivery"
    if delivery_mode == "pickup" and pickup_enabled:
        return "pickup"
    if delivery_enabled:
        return "delivery"
    if pickup_enabled:
        return "pickup"
    return delivery_mode


def resolve_supported_delivery_mode_for_location(
    store: Store,
    delivery_mode: str,
    *,
    customer_latitude: float | None,
    customer_longitude: float | None,
) -> str:
    if not has_valid_coordinates(customer_latitude, customer_longitude):
        return resolve_supported_delivery_mode(store, delivery_mode)

    latitude = float(customer_latitude)
    longitude = float(customer_longitude)
    for candidate in (delivery_mode, "delivery", "pickup"):
        if candidate not in {"delivery", "pickup"}:
            continue
        if candidate == "delivery" and not store_delivery_is_enabled(store):
            continue
        if candidate == "pickup" and not store_pickup_is_enabled(store):
            continue
        if store_covers_location(store, candidate, latitude=latitude, longitude=longitude):  # type: ignore[arg-type]
            return candidate
    return delivery_mode


def ensure_payment_method_supported(store: Store, payment_method: str) -> None:
    settings = store.payment_settings
    if settings is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Store payment settings are not configured")

    if payment_method == "cash" and not settings.cash_enabled:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cash is not available for this store")
    if payment_method == "mercadopago":
        if not settings.mercadopago_enabled:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Mercado Pago is not available for this store")
        if not is_store_mercadopago_ready(store):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Mercado Pago credentials are not configured")
