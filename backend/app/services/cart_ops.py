from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session, object_session, selectinload

from fastapi import HTTPException, status

from app.core.utils import is_store_open
from app.models.order import ShoppingCart, ShoppingCartItem
from app.models.store import Product, Store, StoreCategoryLink
from app.services.delivery import customer_delivery_fee_for_store
from app.services.platform import get_service_fee_amount
from app.services.promotions import applied_promotions_discount_total, calculate_applied_promotions
from app.services.product_pricing import compute_discount_amount, compute_final_price
from app.services.mercadopago import is_store_mercadopago_ready
from app.services.store_address import store_delivery_is_enabled

STORE_OPTIONS = (
    selectinload(Store.category_links).selectinload(StoreCategoryLink.category),
    selectinload(Store.hours),
    selectinload(Store.delivery_settings),
    selectinload(Store.payment_settings),
    selectinload(Store.payment_accounts),
)

CART_OPTIONS = (
    selectinload(ShoppingCart.store).selectinload(Store.category_links).selectinload(StoreCategoryLink.category),
    selectinload(ShoppingCart.store).selectinload(Store.hours),
    selectinload(ShoppingCart.store).selectinload(Store.delivery_settings),
    selectinload(ShoppingCart.store).selectinload(Store.payment_settings),
    selectinload(ShoppingCart.store).selectinload(Store.payment_accounts),
    selectinload(ShoppingCart.items).selectinload(ShoppingCartItem.product),
)


def load_store(db: Session, store_id: int) -> Store | None:
    return db.scalar(select(Store).options(*STORE_OPTIONS).where(Store.id == store_id))


def load_product(db: Session, product_id: int) -> Product | None:
    return db.scalar(select(Product).where(Product.id == product_id))


def get_or_create_cart(db: Session, user_id: int) -> ShoppingCart:
    cart = db.scalar(
        select(ShoppingCart)
        .options(*CART_OPTIONS)
        .execution_options(populate_existing=True)
        .where(ShoppingCart.user_id == user_id)
    )
    if cart is None:
        cart = ShoppingCart(user_id=user_id, subtotal=0, delivery_fee=0, total=0)
        db.add(cart)
        db.flush()
        db.refresh(cart)
        cart = db.scalar(
            select(ShoppingCart)
            .options(*CART_OPTIONS)
            .execution_options(populate_existing=True)
            .where(ShoppingCart.id == cart.id)
        )
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
        service_fee = get_service_fee_amount(object_session(cart))
    cart.delivery_fee = delivery_fee
    cart.service_fee = service_fee
    cart.total = max(0.0, final_items_total - float(cart.financial_discount_total or 0)) + delivery_fee + service_fee
    setattr(cart, "applied_promotions", applied_promotions)


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
    if not is_store_open(store):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Store is closed")


def ensure_delivery_mode_supported(store: Store, delivery_mode: str) -> None:
    settings = store.delivery_settings
    if settings is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Store delivery settings are not configured")

    if delivery_mode == "delivery" and not store_delivery_is_enabled(store):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Delivery is not available for this store")
    if delivery_mode == "pickup" and not settings.pickup_enabled:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Pickup is not available for this store")


def resolve_supported_delivery_mode(store: Store, delivery_mode: str) -> str:
    settings = store.delivery_settings
    delivery_enabled = store_delivery_is_enabled(store)
    pickup_enabled = bool(settings.pickup_enabled) if settings else False

    if delivery_mode == "delivery" and delivery_enabled:
        return "delivery"
    if delivery_mode == "pickup" and pickup_enabled:
        return "pickup"
    if delivery_enabled:
        return "delivery"
    if pickup_enabled:
        return "pickup"
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
