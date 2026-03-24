from sqlalchemy import select
from sqlalchemy.orm import Session

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user
from app.api.presenters import serialize_cart
from app.db.session import get_db
from app.models.order import ShoppingCartItem
from app.models.user import User
from app.schemas.cart import CartItemCreate, CartItemUpdate, CartRead, CartUpdate
from app.services.cart_ops import (
    compute_cart_totals,
    ensure_delivery_mode_supported,
    ensure_store_can_accept_orders,
    get_or_create_cart,
    load_product,
    load_store,
    reload_cart,
)

router = APIRouter()


@router.get("", response_model=CartRead)
def get_cart(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> CartRead:
    cart = get_or_create_cart(db, user.id)
    compute_cart_totals(cart)
    db.commit()
    cart = reload_cart(db, cart.id)
    return serialize_cart(cart)


@router.put("", response_model=CartRead)
def update_cart(
    payload: CartUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> CartRead:
    cart = get_or_create_cart(db, user.id)
    if cart.store is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cart does not have a store yet")
    ensure_delivery_mode_supported(cart.store, payload.delivery_mode)
    cart.delivery_mode = payload.delivery_mode
    compute_cart_totals(cart)
    db.commit()
    cart = reload_cart(db, cart.id)
    return serialize_cart(cart)


@router.post("/items", response_model=CartRead, status_code=status.HTTP_201_CREATED)
def add_cart_item(payload: CartItemCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> CartRead:
    cart = get_or_create_cart(db, user.id)
    store = load_store(db, payload.store_id)
    if store is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")
    ensure_store_can_accept_orders(store)
    product = load_product(db, payload.product_id)
    if product is None or product.store_id != store.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    if not product.is_available:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Product is not available")
    if cart.store_id is not None and cart.store_id != store.id and cart.items:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cart already contains products from another store",
        )
    cart.store_id = store.id
    cart.store = store
    if not cart.items:
        cart.delivery_mode = "delivery" if store.delivery_settings and store.delivery_settings.delivery_enabled else "pickup"
    ensure_delivery_mode_supported(store, cart.delivery_mode)
    item = db.scalar(
        select(ShoppingCartItem).where(
            ShoppingCartItem.cart_id == cart.id, ShoppingCartItem.product_id == payload.product_id
        )
    )
    if item is None:
        item = ShoppingCartItem(
            product_id=payload.product_id,
            product_name_snapshot=product.name,
            quantity=payload.quantity,
            unit_price_snapshot=product.price,
            note=payload.note,
        )
        cart.items.append(item)
    else:
        item.quantity += payload.quantity
        item.product_name_snapshot = product.name
        item.unit_price_snapshot = product.price
        item.note = payload.note
    db.flush()
    cart = reload_cart(db, cart.id)
    compute_cart_totals(cart)
    db.commit()
    cart = reload_cart(db, cart.id)
    return serialize_cart(cart)


@router.put("/items/{item_id}", response_model=CartRead)
def update_cart_item(item_id: int, payload: CartItemUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> CartRead:
    cart = get_or_create_cart(db, user.id)
    item = db.scalar(select(ShoppingCartItem).where(ShoppingCartItem.id == item_id, ShoppingCartItem.cart_id == cart.id))
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cart item not found")
    if payload.quantity <= 0:
        db.delete(item)
    else:
        item.quantity = payload.quantity
        item.note = payload.note
    db.flush()
    cart = reload_cart(db, cart.id)
    compute_cart_totals(cart)
    db.commit()
    cart = reload_cart(db, cart.id)
    return serialize_cart(cart)


@router.delete("/items/{item_id}", response_model=CartRead)
def delete_cart_item(item_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> CartRead:
    cart = get_or_create_cart(db, user.id)
    item = db.scalar(select(ShoppingCartItem).where(ShoppingCartItem.id == item_id, ShoppingCartItem.cart_id == cart.id))
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cart item not found")
    db.delete(item)
    db.flush()
    cart = reload_cart(db, cart.id)
    compute_cart_totals(cart)
    db.commit()
    cart = reload_cart(db, cart.id)
    return serialize_cart(cart)


@router.delete("", response_model=CartRead)
def clear_cart(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> CartRead:
    cart = get_or_create_cart(db, user.id)
    for item in list(cart.items):
        db.delete(item)
    cart.store_id = None
    cart.store = None
    cart.delivery_mode = "delivery"
    cart.subtotal = 0
    cart.delivery_fee = 0
    cart.service_fee = 0
    cart.total = 0
    db.commit()
    cart = reload_cart(db, cart.id)
    return serialize_cart(cart)
