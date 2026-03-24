from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.utils import build_address_text
from app.db.session import get_db
from app.models.order import StoreOrder, StoreOrderItem
from app.models.user import Address, User
from app.schemas.order import CheckoutRequest, CheckoutResponse
from app.services.cart_ops import (
    compute_cart_totals,
    ensure_delivery_mode_supported,
    ensure_payment_method_supported,
    ensure_store_can_accept_orders,
    get_or_create_cart,
)
from app.services.delivery import bootstrap_delivery_order, publish_order_snapshot, snapshot_delivery_quote
from app.services.mercadopago import MercadoPagoAPIError, create_checkout_preference

router = APIRouter()


def build_payment_items(cart: object, *, delivery_fee: float) -> list[dict[str, object]]:
    items = [
        {
            "title": item.product_name_snapshot,
            "quantity": item.quantity,
            "unit_price": float(item.unit_price_snapshot),
            "currency_id": "ARS",
        }
        for item in cart.items
    ]
    if cart.delivery_mode == "delivery" and float(delivery_fee) > 0:
        items.append(
            {
                "title": "Envio",
                "quantity": 1,
                "unit_price": float(delivery_fee),
                "currency_id": "ARS",
            }
        )
    if float(cart.service_fee) > 0:
        items.append(
            {
                "title": "Servicio",
                "quantity": 1,
                "unit_price": float(cart.service_fee),
                "currency_id": "ARS",
            }
        )
    return items


@router.post("", response_model=CheckoutResponse, status_code=status.HTTP_201_CREATED)
def checkout(
    payload: CheckoutRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> CheckoutResponse:
    cart = get_or_create_cart(db, user.id)
    if not cart.items or cart.store_id is None or cart.store is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cart is empty")
    if cart.store_id != payload.store_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Checkout store does not match cart store")

    store = cart.store
    ensure_store_can_accept_orders(store)
    ensure_delivery_mode_supported(store, payload.delivery_mode)
    ensure_payment_method_supported(store, payload.payment_method)

    address = None
    if payload.delivery_mode == "delivery":
        if payload.address_id is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Address is required for delivery")
        address = db.scalar(select(Address).where(Address.id == payload.address_id, Address.user_id == user.id))
        if address is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Address not found")

    cart.delivery_mode = payload.delivery_mode
    compute_cart_totals(cart)
    try:
        delivery_quote = snapshot_delivery_quote(
            db,
            store=store,
            address=address,
            delivery_mode=payload.delivery_mode,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    delivery_fee_customer = float(delivery_quote["delivery_fee_customer"])
    rider_fee = float(delivery_quote["rider_fee"])
    total = float(cart.subtotal) + delivery_fee_customer + float(cart.service_fee)
    otp_code = str(100000 + (uuid.uuid4().int % 900000)) if delivery_quote["otp_required"] else None

    order = StoreOrder(
        user_id=user.id,
        store_id=store.id,
        address_id=address.id if address else None,
        delivery_mode=payload.delivery_mode,
        payment_method=payload.payment_method,
        payment_status="pending",
        customer_name_snapshot=user.full_name,
        store_name_snapshot=store.name,
        store_slug_snapshot=store.slug,
        store_address_snapshot=store.address,
        address_label_snapshot=address.label if address else None,
        address_full_snapshot=build_address_text(address) if address else None,
        subtotal=cart.subtotal,
        delivery_fee=delivery_fee_customer,
        service_fee=cart.service_fee,
        delivery_fee_customer=delivery_fee_customer,
        rider_fee=rider_fee,
        total=total,
        status="created",
        delivery_status="unassigned",
        delivery_provider=str(delivery_quote["provider"]),
        delivery_zone_id=delivery_quote["zone"].id if delivery_quote["zone"] is not None else None,
        otp_required=bool(delivery_quote["otp_required"]),
        otp_code=otp_code,
    )
    db.add(order)
    db.flush()

    for item in cart.items:
        db.add(
            StoreOrderItem(
                order_id=order.id,
                product_id=item.product_id,
                product_name_snapshot=item.product_name_snapshot,
                unit_price_snapshot=item.unit_price_snapshot,
                quantity=item.quantity,
                note=item.note,
            )
        )

    checkout_url = None
    payment_reference = None
    if payload.payment_method == "mercadopago":
        payment_reference = f"mp_{uuid.uuid4().hex[:18]}"
        order.payment_reference = payment_reference
        if settings.mercadopago_simulated:
            checkout_url = (
                f"{settings.frontend_base_url}/payments/mercadopago/simulated"
                f"?reference={payment_reference}&order_id={order.id}"
            )
        else:
            try:
                preference = create_checkout_preference(
                    store=store,
                    payer_email=user.email,
                    order_id=order.id,
                    reference=payment_reference,
                    items=build_payment_items(cart, delivery_fee=delivery_fee_customer),
                    marketplace_fee=float(order.service_fee + order.delivery_fee_customer),
                )
            except MercadoPagoAPIError as exc:
                db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=str(exc),
                ) from exc
            checkout_url = preference["checkout_url"]

    for item in list(cart.items):
        db.delete(item)
    cart.store_id = None
    cart.store = None
    cart.delivery_mode = "delivery"
    cart.subtotal = 0
    cart.delivery_fee = 0
    cart.service_fee = 0
    cart.total = 0

    bootstrap_delivery_order(db, order)
    db.commit()
    db.refresh(order)
    publish_order_snapshot(order, event_type="order.created")
    return CheckoutResponse(
        order_id=order.id,
        status=order.status,
        payment_status=order.payment_status,
        payment_reference=payment_reference,
        checkout_url=checkout_url,
    )
