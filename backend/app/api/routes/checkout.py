from __future__ import annotations

import uuid
from decimal import Decimal, ROUND_DOWN, ROUND_HALF_UP

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.utils import build_address_text
from app.db.session import get_db
from app.models.order import StoreOrder, StoreOrderItem
from app.models.payment import PaymentTransaction
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
from app.services.payment_transactions import (
    attach_preference,
    attach_simulated_checkout,
    create_payment_transaction,
)
from app.services.promotions import persist_order_promotions

router = APIRouter()


MONEY_QUANTIZER = Decimal("0.01")


def _find_idempotent_transaction(
    db: Session, *, user_id: int, idempotency_key: str
) -> PaymentTransaction | None:
    return db.scalar(
        select(PaymentTransaction)
        .join(StoreOrder, StoreOrder.id == PaymentTransaction.order_id)
        .where(
            PaymentTransaction.provider == "mercadopago",
            PaymentTransaction.idempotency_key == idempotency_key,
            StoreOrder.user_id == user_id,
        )
    )


def _checkout_response_from_transaction(transaction: PaymentTransaction) -> CheckoutResponse:
    order = transaction.order
    return CheckoutResponse(
        order_id=order.id,
        status=order.status,
        payment_status=order.payment_status,
        payment_reference=transaction.external_reference,
        payment_transaction_id=transaction.id,
        provider_preference_id=transaction.preference_id,
        checkout_url=transaction.checkout_url,
    )


def _transaction_matches_checkout_payload(
    transaction: PaymentTransaction, payload: CheckoutRequest
) -> bool:
    order = transaction.order
    return bool(
        order
        and order.store_id == payload.store_id
        and order.delivery_mode == payload.delivery_mode
        and order.payment_method == payload.payment_method
        and (
            payload.delivery_mode != "delivery"
            or order.address_id == payload.address_id
        )
    )


def _money(value: object) -> Decimal:
    return Decimal(str(value or 0)).quantize(MONEY_QUANTIZER, rounding=ROUND_HALF_UP)


def _money_to_float(value: Decimal) -> float:
    return float(value.quantize(MONEY_QUANTIZER, rounding=ROUND_HALF_UP))


def _serialize_payment_item(title: str, quantity: int, unit_price: Decimal) -> dict[str, object]:
    return {
        "title": title,
        "quantity": quantity,
        "unit_price": _money_to_float(unit_price),
        "currency_id": "ARS",
    }


def _sum_payment_items(items: list[dict[str, object]]) -> Decimal:
    total = Decimal("0.00")
    for item in items:
        total += _money(item["unit_price"]) * Decimal(int(item["quantity"]))
    return total.quantize(MONEY_QUANTIZER, rounding=ROUND_HALF_UP)


def _build_product_payment_items(order: StoreOrder) -> list[dict[str, object]]:
    return [
        _serialize_payment_item(
            title=item.product_name_snapshot,
            quantity=int(item.quantity),
            unit_price=_money(item.unit_price_snapshot),
        )
        for item in order.items
    ]


def _prorate_discount_across_products(
    product_items: list[dict[str, object]], discount_total: Decimal
) -> list[dict[str, object]]:
    discount_total = _money(discount_total)
    if discount_total <= 0:
        return product_items

    expanded_units: list[dict[str, object]] = []
    total_cents = 0
    for item in product_items:
        unit_price_cents = int((_money(item["unit_price"]) * 100).to_integral_value(rounding=ROUND_HALF_UP))
        quantity = int(item["quantity"])
        for _ in range(quantity):
            expanded_units.append({"title": str(item["title"]), "unit_price_cents": unit_price_cents})
            total_cents += unit_price_cents

    discount_cents = int((discount_total * 100).to_integral_value(rounding=ROUND_HALF_UP))
    if not expanded_units or discount_cents > total_cents:
        raise MercadoPagoAPIError("Promotion discount exceeds the payable product total")

    allocated_cents = 0
    for unit in expanded_units:
        exact_share = (Decimal(discount_cents) * Decimal(unit["unit_price_cents"])) / Decimal(total_cents)
        floor_share = int(exact_share.to_integral_value(rounding=ROUND_DOWN))
        unit["discount_cents"] = floor_share
        unit["remainder"] = exact_share - Decimal(floor_share)
        allocated_cents += floor_share

    remaining_cents = discount_cents - allocated_cents
    if remaining_cents > 0:
        ranked_indexes = sorted(
            range(len(expanded_units)),
            key=lambda index: (
                expanded_units[index]["remainder"],
                expanded_units[index]["unit_price_cents"],
                -index,
            ),
            reverse=True,
        )
        for index in ranked_indexes[:remaining_cents]:
            expanded_units[index]["discount_cents"] += 1

    adjusted_items: list[dict[str, object]] = []
    for unit in expanded_units:
        net_cents = unit["unit_price_cents"] - unit["discount_cents"]
        if net_cents < 0:
            raise MercadoPagoAPIError("Promotion discount exceeds the payable product total")
        unit_price = Decimal(net_cents) / Decimal(100)
        if adjusted_items and adjusted_items[-1]["title"] == unit["title"] and _money(adjusted_items[-1]["unit_price"]) == unit_price:
            adjusted_items[-1]["quantity"] = int(adjusted_items[-1]["quantity"]) + 1
            continue
        adjusted_items.append(_serialize_payment_item(str(unit["title"]), 1, unit_price))
    return adjusted_items


def build_payment_items(
    order: StoreOrder, *, allow_negative_promotion_item: bool = True
) -> list[dict[str, object]]:
    items = _build_product_payment_items(order)
    financial_discount_total = _money(getattr(order, "financial_discount_total", 0) or 0)
    if financial_discount_total > 0 and not allow_negative_promotion_item:
        items = _prorate_discount_across_products(items, financial_discount_total)

    delivery_fee = _money(getattr(order, "delivery_fee_customer", order.delivery_fee) or 0)
    if order.delivery_mode == "delivery" and delivery_fee > 0:
        items.append(_serialize_payment_item("Envio", 1, delivery_fee))
    if financial_discount_total > 0 and allow_negative_promotion_item:
        items.append(_serialize_payment_item("Promociones", 1, -financial_discount_total))

    service_fee = _money(order.service_fee)
    if service_fee > 0:
        items.append(_serialize_payment_item("Servicio", 1, service_fee))
    return items


def validate_checkout_split_payload(
    order: StoreOrder, *, items: list[dict[str, object]], marketplace_fee: float
) -> None:
    order_total = _money(order.total)
    items_total = _sum_payment_items(items)
    service_fee = _money(order.service_fee)
    actual_marketplace_fee = _money(marketplace_fee)
    expected_delivery_fee = _money(getattr(order, "delivery_fee_customer", order.delivery_fee) or 0)
    actual_delivery_fee = sum(
        (_money(item["unit_price"]) * Decimal(int(item["quantity"])) for item in items if item["title"] == "Envio"),
        Decimal("0.00"),
    ).quantize(MONEY_QUANTIZER, rounding=ROUND_HALF_UP)
    actual_service_item_total = sum(
        (_money(item["unit_price"]) * Decimal(int(item["quantity"])) for item in items if item["title"] == "Servicio"),
        Decimal("0.00"),
    ).quantize(MONEY_QUANTIZER, rounding=ROUND_HALF_UP)

    if actual_marketplace_fee != service_fee:
        raise MercadoPagoAPIError("Marketplace fee must match the order service fee")
    if items_total != order_total:
        raise MercadoPagoAPIError("Mercado Pago preference items total must match the order total")
    if actual_delivery_fee != expected_delivery_fee:
        raise MercadoPagoAPIError("Delivery fee must remain on the merchant side of the split")
    if actual_service_item_total != service_fee:
        raise MercadoPagoAPIError("Service fee must remain charged to the buyer and mapped to marketplace_fee")
    if items_total - actual_marketplace_fee != order_total - service_fee:
        raise MercadoPagoAPIError("Seller settlement amount does not match the expected split payout")


@router.post("", response_model=CheckoutResponse, status_code=status.HTTP_201_CREATED)
def checkout(
    payload: CheckoutRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> CheckoutResponse:
    idempotency_key = (payload.idempotency_key or "").strip() or None
    if idempotency_key:
        existing_transaction = _find_idempotent_transaction(
            db,
            user_id=user.id,
            idempotency_key=idempotency_key,
        )
        if existing_transaction is not None:
            if not _transaction_matches_checkout_payload(existing_transaction, payload):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Idempotency key was already used for a different checkout",
                )
            return _checkout_response_from_transaction(existing_transaction)

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
        if address.latitude is None or address.longitude is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La direccion seleccionada debe tener geolocalizacion obligatoria",
            )

    cart.delivery_mode = payload.delivery_mode
    compute_cart_totals(cart)
    commercial_discount_total = float(getattr(cart, "commercial_discount_total", 0) or 0)
    financial_discount_total = float(getattr(cart, "financial_discount_total", 0) or 0)
    try:
        discounted_subtotal = max(
            0.0,
            float(cart.subtotal) - commercial_discount_total - financial_discount_total,
        )
        delivery_quote = snapshot_delivery_quote(
            db,
            store=store,
            address=address,
            delivery_mode=payload.delivery_mode,
            discounted_subtotal=discounted_subtotal,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    delivery_fee_customer = float(delivery_quote["delivery_fee_customer"])
    rider_fee = float(delivery_quote["rider_fee"])
    total = float(cart.subtotal) - commercial_discount_total - financial_discount_total + delivery_fee_customer + float(cart.service_fee)
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
        commercial_discount_total=commercial_discount_total,
        financial_discount_total=financial_discount_total,
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
                order=order,
                product_id=item.product_id,
                product_name_snapshot=item.product_name_snapshot,
                base_unit_price_snapshot=getattr(item, "base_unit_price_snapshot", item.unit_price_snapshot),
                unit_price_snapshot=item.unit_price_snapshot,
                commercial_discount_amount_snapshot=getattr(item, "commercial_discount_amount_snapshot", 0),
                quantity=item.quantity,
                note=item.note,
            )
        )
    persist_order_promotions(
        db,
        order=order,
        applied_promotions=list(getattr(cart, "applied_promotions", []) or []),
    )

    checkout_url = None
    payment_reference = None
    payment_transaction = None
    if payload.payment_method == "mercadopago":
        payment_reference = f"mp_{uuid.uuid4().hex[:18]}"
        order.payment_reference = payment_reference
        try:
            payment_transaction = create_payment_transaction(
                db,
                order=order,
                store=store,
                external_reference=payment_reference,
                idempotency_key=idempotency_key,
            )
        except IntegrityError as exc:
            db.rollback()
            if idempotency_key:
                existing_transaction = _find_idempotent_transaction(
                    db,
                    user_id=user.id,
                    idempotency_key=idempotency_key,
                )
                if existing_transaction is not None:
                    if not _transaction_matches_checkout_payload(existing_transaction, payload):
                        raise HTTPException(
                            status_code=status.HTTP_409_CONFLICT,
                            detail="Idempotency key was already used for a different checkout",
                        )
                    return _checkout_response_from_transaction(existing_transaction)
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Checkout already exists for this idempotency key",
            ) from exc
        if settings.mercadopago_simulated:
            checkout_url = (
                f"{settings.frontend_base_url}/payments/mercadopago/simulated"
                f"?reference={payment_reference}&order_id={order.id}"
            )
            attach_simulated_checkout(payment_transaction, checkout_url)
        else:
            primary_items = build_payment_items(order, allow_negative_promotion_item=True)
            fallback_items = (
                build_payment_items(order, allow_negative_promotion_item=False)
                if _money(order.financial_discount_total) > 0
                else None
            )
            validate_checkout_split_payload(order, items=primary_items, marketplace_fee=float(order.service_fee))
            if fallback_items is not None:
                validate_checkout_split_payload(order, items=fallback_items, marketplace_fee=float(order.service_fee))
            try:
                preference = create_checkout_preference(
                    store=store,
                    payer_email=user.email,
                    order_id=order.id,
                    reference=payment_reference,
                    items=primary_items,
                    marketplace_fee=float(order.service_fee),
                    fallback_items=fallback_items,
                )
            except MercadoPagoAPIError as exc:
                db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=str(exc),
                ) from exc
            checkout_url = preference["checkout_url"]
            attach_preference(payment_transaction, preference)

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

    bootstrap_delivery_order(db, order)
    db.commit()
    db.refresh(order)
    publish_order_snapshot(order, event_type="order.created")
    return CheckoutResponse(
        order_id=order.id,
        status=order.status,
        payment_status=order.payment_status,
        payment_reference=payment_reference,
        payment_transaction_id=payment_transaction.id if payment_transaction else None,
        provider_preference_id=payment_transaction.preference_id if payment_transaction else None,
        checkout_url=checkout_url,
    )
