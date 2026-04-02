from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import require_delivery
from app.api.presenters import serialize_delivery_profile, serialize_notification, serialize_order
from app.db.session import get_db
from app.models.delivery import DeliveryProfile, NotificationEvent, RiderSettlementCharge, RiderSettlementPayment
from app.models.order import StoreOrder
from app.models.store import Store
from app.models.user import User
from app.schemas.delivery import (
    DeliveryAvailabilityUpdate,
    DeliveryDeliverRequest,
    DeliveryLocationUpdate,
    DeliverySettlementPaymentAction,
    DeliverySettlementPaymentRead,
)
from app.services.delivery import (
    accept_delivery_offer,
    create_notifications,
    publish_order_snapshot,
    rider_deliver_order,
    rider_pick_up_order,
    sync_delivery_location,
)
from app.services.settlements import get_rider_payments

router = APIRouter()


PROFILE_OPTIONS = (
    selectinload(DeliveryProfile.user),
    selectinload(DeliveryProfile.application),
    selectinload(DeliveryProfile.zone),
    selectinload(DeliveryProfile.store),
)

ORDER_OPTIONS = (
    selectinload(StoreOrder.items),
    selectinload(StoreOrder.store),
    selectinload(StoreOrder.address),
    selectinload(StoreOrder.delivery_assignment),
    selectinload(StoreOrder.promotion_applications),
)

PAYMENT_OPTIONS = (
    selectinload(RiderSettlementPayment.store),
)


def get_delivery_profile(db: Session, user_id: int) -> DeliveryProfile:
    profile = db.scalar(select(DeliveryProfile).options(*PROFILE_OPTIONS).where(DeliveryProfile.user_id == user_id))
    if profile is None or not profile.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery profile not found")
    return profile


def _admin_user_ids(db: Session) -> list[int]:
    return list(db.scalars(select(User.id).where(User.role == "admin", User.is_active.is_(True))))


def _serialize_delivery_payment(payment: RiderSettlementPayment) -> DeliverySettlementPaymentRead:
    store = payment.store
    return DeliverySettlementPaymentRead(
        id=payment.id,
        rider_user_id=payment.rider_user_id,
        store_id=payment.store_id,
        store_name=store.name if store is not None else None,
        amount=float(payment.amount),
        paid_at=payment.paid_at,
        reference=payment.reference,
        notes=payment.notes,
        receiver_status=str(payment.receiver_status or "pending_confirmation"),
        receiver_response_notes=payment.receiver_response_notes,
        receiver_responded_at=payment.receiver_responded_at,
        created_at=payment.created_at,
    )


def _get_rider_payment(db: Session, *, rider_user_id: int, payment_id: int) -> RiderSettlementPayment:
    payment = db.scalar(
        select(RiderSettlementPayment)
        .options(*PAYMENT_OPTIONS)
        .where(RiderSettlementPayment.id == payment_id, RiderSettlementPayment.rider_user_id == rider_user_id)
    )
    if payment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Settlement payment not found")
    return payment


def get_rider_order(db: Session, rider_id: int, order_id: int) -> StoreOrder:
    order = db.scalar(
        select(StoreOrder)
        .options(*ORDER_OPTIONS)
        .where(StoreOrder.id == order_id, StoreOrder.delivery_provider == "platform", StoreOrder.delivery_mode == "delivery")
    )
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    assignment = order.delivery_assignment
    if assignment is None or assignment.rider_user_id != rider_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Order is not assigned to this rider")
    return order


@router.get("/me")
def get_me(user: User = Depends(require_delivery), db: Session = Depends(get_db)) -> dict[str, object]:
    return serialize_delivery_profile(get_delivery_profile(db, user.id)).model_dump()


@router.put("/me/availability")
def update_availability(
    payload: DeliveryAvailabilityUpdate,
    user: User = Depends(require_delivery),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    profile = get_delivery_profile(db, user.id)
    profile.availability = payload.availability
    profile.current_zone_id = payload.zone_id
    db.commit()
    db.refresh(profile)
    return serialize_delivery_profile(profile).model_dump()


@router.get("/me/orders")
def list_my_orders(user: User = Depends(require_delivery), db: Session = Depends(get_db)) -> list[dict[str, object]]:
    orders = db.scalars(
        select(StoreOrder)
        .options(*ORDER_OPTIONS)
        .where(
            StoreOrder.delivery_provider == "platform",
            StoreOrder.delivery_mode == "delivery",
            or_(
                StoreOrder.assigned_rider_id == user.id,
                StoreOrder.delivery_assignment.has(rider_user_id=user.id),
            ),
        )
        .order_by(StoreOrder.id.desc())
    ).all()
    return [serialize_order(order).model_dump() for order in orders]


@router.post("/me/orders/{order_id}/accept")
def accept_order(
    order_id: int,
    user: User = Depends(require_delivery),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    order = get_rider_order(db, user.id, order_id)
    try:
        accept_delivery_offer(db, order=order, rider=user)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    db.commit()
    db.refresh(order)
    publish_order_snapshot(order, event_type="delivery.assigned")
    return serialize_order(order).model_dump()


@router.post("/me/orders/{order_id}/pickup")
def pick_up_order(
    order_id: int,
    user: User = Depends(require_delivery),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    order = get_rider_order(db, user.id, order_id)
    try:
        rider_pick_up_order(db, order=order, rider=user)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    db.commit()
    db.refresh(order)
    publish_order_snapshot(order, event_type="delivery.picked_up")
    return serialize_order(order).model_dump()


@router.post("/me/orders/{order_id}/deliver")
def deliver_order(
    order_id: int,
    payload: DeliveryDeliverRequest,
    user: User = Depends(require_delivery),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    order = get_rider_order(db, user.id, order_id)
    try:
        rider_deliver_order(db, order=order, rider=user, otp_code=payload.otp_code)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    db.commit()
    db.refresh(order)
    publish_order_snapshot(order, event_type="order.delivered")
    return serialize_order(order).model_dump()


@router.post("/me/location")
def push_location(
    payload: DeliveryLocationUpdate,
    user: User = Depends(require_delivery),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    order = get_rider_order(db, user.id, payload.order_id)
    try:
        sync_delivery_location(
            db,
            order=order,
            rider=user,
            latitude=payload.latitude,
            longitude=payload.longitude,
            heading=payload.heading,
            speed_kmh=payload.speed_kmh,
            accuracy_meters=payload.accuracy_meters,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    db.commit()
    db.refresh(order)
    publish_order_snapshot(order, event_type="delivery.location")
    return serialize_order(order).model_dump()


@router.get("/me/notifications")
def list_notifications(
    user: User = Depends(require_delivery), db: Session = Depends(get_db)
) -> list[dict[str, object]]:
    notifications = db.scalars(
        select(NotificationEvent)
        .where(NotificationEvent.user_id == user.id)
        .order_by(NotificationEvent.created_at.desc(), NotificationEvent.id.desc())
    ).all()
    return [serialize_notification(notification).model_dump() for notification in notifications]


@router.get("/me/settlements")
def get_settlements(user: User = Depends(require_delivery), db: Session = Depends(get_db)) -> dict[str, object]:
    profile = get_delivery_profile(db, user.id)
    store_id = profile.store_id
    rider_fee_earned_total = db.scalar(
        select(func.coalesce(func.sum(StoreOrder.rider_fee), 0)).where(
            StoreOrder.assigned_rider_id == user.id,
            StoreOrder.store_id == store_id,
            StoreOrder.status == "delivered",
        )
    )
    rider_fee_paid_total = db.scalar(
        select(func.coalesce(func.sum(RiderSettlementPayment.amount), 0)).where(
            RiderSettlementPayment.rider_user_id == user.id,
            RiderSettlementPayment.store_id == store_id,
        )
    )
    earned = float(rider_fee_earned_total or 0)
    paid = float(rider_fee_paid_total or 0)
    return {
        "rider_user_id": user.id,
        "rider_name": profile.user.full_name,
        "vehicle_type": profile.vehicle_type,
        "cash_liability_total": 0.0,
        "cash_liability_open": 0.0,
        "rider_fee_earned_total": earned,
        "rider_fee_paid_total": paid,
        "pending_amount": max(0.0, earned - paid),
        "merchant_cash_payable_total": 0.0,
    }


@router.get("/me/settlement-payments", response_model=list[DeliverySettlementPaymentRead])
def list_settlement_payments(
    user: User = Depends(require_delivery),
    db: Session = Depends(get_db),
) -> list[DeliverySettlementPaymentRead]:
    profile = get_delivery_profile(db, user.id)
    return [
        _serialize_delivery_payment(payment)
        for payment in get_rider_payments(db, rider_user_id=user.id, store_id=profile.store_id)
    ]


@router.post("/me/settlement-payments/{payment_id}/confirm", response_model=DeliverySettlementPaymentRead)
def confirm_settlement_payment(
    payment_id: int,
    payload: DeliverySettlementPaymentAction,
    user: User = Depends(require_delivery),
    db: Session = Depends(get_db),
) -> DeliverySettlementPaymentRead:
    payment = _get_rider_payment(db, rider_user_id=user.id, payment_id=payment_id)
    payment.receiver_status = "confirmed"
    payment.receiver_response_notes = (payload.notes or "").strip() or None
    payment.receiver_responded_at = datetime.now(UTC)
    notification_user_ids: list[int] = []
    if payment.store_id is not None:
        store = db.scalar(select(Store).where(Store.id == payment.store_id))
        if store is not None and store.owner_user_id is not None:
            notification_user_ids.append(store.owner_user_id)
    if payment.created_by_user_id is not None:
        notification_user_ids.append(payment.created_by_user_id)
    notification_user_ids.extend(_admin_user_ids(db))
    create_notifications(
        db,
        user_ids=notification_user_ids,
        order_id=None,
        event_type="delivery.settlement_confirmed",
        title="Pago confirmado por rider",
        body=f"{user.full_name} confirmo la recepcion del pago.",
        payload={"payment_id": payment.id, "rider_user_id": user.id, "status": payment.receiver_status},
    )
    db.commit()
    refreshed = _get_rider_payment(db, rider_user_id=user.id, payment_id=payment_id)
    return _serialize_delivery_payment(refreshed)


@router.post("/me/settlement-payments/{payment_id}/dispute", response_model=DeliverySettlementPaymentRead)
def dispute_settlement_payment(
    payment_id: int,
    payload: DeliverySettlementPaymentAction,
    user: User = Depends(require_delivery),
    db: Session = Depends(get_db),
) -> DeliverySettlementPaymentRead:
    payment = _get_rider_payment(db, rider_user_id=user.id, payment_id=payment_id)
    payment.receiver_status = "disputed"
    payment.receiver_response_notes = (payload.notes or "").strip() or None
    payment.receiver_responded_at = datetime.now(UTC)
    notification_user_ids: list[int] = []
    if payment.store_id is not None:
        store = db.scalar(select(Store).where(Store.id == payment.store_id))
        if store is not None and store.owner_user_id is not None:
            notification_user_ids.append(store.owner_user_id)
    if payment.created_by_user_id is not None:
        notification_user_ids.append(payment.created_by_user_id)
    notification_user_ids.extend(_admin_user_ids(db))
    create_notifications(
        db,
        user_ids=notification_user_ids,
        order_id=None,
        event_type="delivery.settlement_disputed",
        title="Pago observado por rider",
        body=f"{user.full_name} marco una diferencia en la recepcion del pago.",
        payload={
            "payment_id": payment.id,
            "rider_user_id": user.id,
            "status": payment.receiver_status,
            "notes": payment.receiver_response_notes,
        },
    )
    db.commit()
    refreshed = _get_rider_payment(db, rider_user_id=user.id, payment_id=payment_id)
    return _serialize_delivery_payment(refreshed)
