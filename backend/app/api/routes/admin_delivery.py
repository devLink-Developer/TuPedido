from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import require_admin
from app.api.presenters import (
    serialize_delivery_application,
    serialize_delivery_profile,
    serialize_delivery_zone,
    serialize_order,
    serialize_rider_settlement_payment,
)
from app.core.security import hash_password
from app.db.session import get_db
from app.models.delivery import (
    DeliveryApplication,
    DeliveryProfile,
    DeliveryZone,
    DeliveryZoneRate,
    MerchantCashDeliveryPayable,
    RiderSettlementCharge,
    RiderSettlementPayment,
)
from app.models.order import StoreOrder
from app.models.store import Store
from app.models.user import User
from app.schemas.admin import AdminRiderCreate
from app.schemas.delivery import (
    DeliveryApplicationReview,
    DeliveryAssignRequest,
    DeliverySettlementPaymentCreate,
    DeliveryZoneWrite,
)
from app.schemas.settlement import RiderSettlementPaymentRead
from app.services.delivery import create_notifications, ensure_assignment, mask_phone, publish_order_snapshot

router = APIRouter()


APPLICATION_OPTIONS = (
    selectinload(DeliveryApplication.user),
    selectinload(DeliveryApplication.store),
    selectinload(DeliveryApplication.profile),
)

RIDER_OPTIONS = (
    selectinload(DeliveryProfile.user),
    selectinload(DeliveryProfile.application),
    selectinload(DeliveryProfile.store),
    selectinload(DeliveryProfile.zone),
)

ZONE_OPTIONS = (selectinload(DeliveryZone.rates),)

ORDER_OPTIONS = (
    selectinload(StoreOrder.items),
    selectinload(StoreOrder.store),
    selectinload(StoreOrder.address),
    selectinload(StoreOrder.promotion_applications),
)

PAYMENT_OPTIONS = (
    selectinload(RiderSettlementPayment.store),
    selectinload(RiderSettlementPayment.rider),
)


@router.get("/delivery-applications")
def list_delivery_applications(
    _: User = Depends(require_admin), db: Session = Depends(get_db)
) -> list[dict[str, object]]:
    applications = db.scalars(
        select(DeliveryApplication).options(*APPLICATION_OPTIONS).order_by(DeliveryApplication.id.desc())
    ).all()
    return [serialize_delivery_application(application).model_dump() for application in applications]


@router.put("/delivery-applications/{application_id}")
def review_delivery_application(
    application_id: int,
    payload: DeliveryApplicationReview,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    application = db.scalar(
        select(DeliveryApplication).options(*APPLICATION_OPTIONS).where(DeliveryApplication.id == application_id)
    )
    if application is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery application not found")

    application.status = payload.status
    application.review_notes = payload.review_notes
    application.reviewed_by_user_id = admin.id
    application.reviewed_at = datetime.now(UTC)

    profile = db.get(DeliveryProfile, application.user_id)
    if payload.status == "approved":
        if profile is None:
            profile = DeliveryProfile(
                user_id=application.user_id,
                application_id=application.id,
                phone=application.phone,
                vehicle_type=application.vehicle_type,
                photo_url=application.photo_url,
                dni_number=application.dni_number,
                emergency_contact_name=application.emergency_contact_name,
                emergency_contact_phone=application.emergency_contact_phone,
                license_number=application.license_number,
                vehicle_plate=application.vehicle_plate,
                insurance_policy=application.insurance_policy,
                availability="offline",
                is_active=True,
                approved_by_user_id=admin.id,
                approved_at=datetime.now(UTC),
            )
            db.add(profile)
        else:
            profile.application_id = application.id
            profile.phone = application.phone
            profile.vehicle_type = application.vehicle_type
            profile.photo_url = application.photo_url
            profile.dni_number = application.dni_number
            profile.emergency_contact_name = application.emergency_contact_name
            profile.emergency_contact_phone = application.emergency_contact_phone
            profile.license_number = application.license_number
            profile.vehicle_plate = application.vehicle_plate
            profile.insurance_policy = application.insurance_policy
            profile.is_active = True
            profile.approved_by_user_id = admin.id
            profile.approved_at = datetime.now(UTC)
        application.user.role = "delivery"
    elif payload.status == "suspended":
        if profile is not None:
            profile.is_active = False
            profile.availability = "offline"
    elif payload.status == "rejected" and application.user.role != "admin":
        application.user.role = "customer"

    db.commit()
    refreshed = db.scalar(
        select(DeliveryApplication).options(*APPLICATION_OPTIONS).where(DeliveryApplication.id == application_id)
    )
    assert refreshed is not None
    return serialize_delivery_application(refreshed).model_dump()


@router.get("/delivery/riders")
def list_riders(_: User = Depends(require_admin), db: Session = Depends(get_db)) -> list[dict[str, object]]:
    riders = db.scalars(select(DeliveryProfile).options(*RIDER_OPTIONS).order_by(DeliveryProfile.user_id)).all()
    return [serialize_delivery_profile(rider).model_dump() for rider in riders]


@router.post("/delivery/riders", status_code=status.HTTP_201_CREATED)
def create_rider(
    payload: AdminRiderCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    existing_user = db.scalar(select(User).where(User.email == payload.email))
    if existing_user is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    zone = None
    if payload.current_zone_id is not None:
        zone = db.scalar(select(DeliveryZone).where(DeliveryZone.id == payload.current_zone_id))
        if zone is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Delivery zone not found")

    user = User(
        full_name=payload.full_name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role="delivery",
        is_active=True,
    )
    db.add(user)
    db.flush()

    application = DeliveryApplication(
        user_id=user.id,
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
        review_notes=payload.review_notes or "Alta directa por admin",
        reviewed_by_user_id=admin.id,
        reviewed_at=datetime.now(UTC),
    )
    db.add(application)
    db.flush()

    profile = DeliveryProfile(
        user_id=user.id,
        application_id=application.id,
        phone=payload.phone,
        vehicle_type=payload.vehicle_type,
        photo_url=payload.photo_url,
        dni_number=payload.dni_number,
        emergency_contact_name=payload.emergency_contact_name,
        emergency_contact_phone=payload.emergency_contact_phone,
        license_number=payload.license_number,
        vehicle_plate=payload.vehicle_plate,
        insurance_policy=payload.insurance_policy,
        availability=payload.availability,
        is_active=payload.is_active,
        current_zone_id=zone.id if zone else None,
        approved_by_user_id=admin.id,
        approved_at=datetime.now(UTC),
    )
    db.add(profile)

    db.commit()
    created_profile = db.scalar(select(DeliveryProfile).options(*RIDER_OPTIONS).where(DeliveryProfile.user_id == user.id))
    assert created_profile is not None
    return serialize_delivery_profile(created_profile).model_dump()


@router.get("/delivery/zones")
def list_delivery_zones(_: User = Depends(require_admin), db: Session = Depends(get_db)) -> list[dict[str, object]]:
    zones = db.scalars(select(DeliveryZone).options(*ZONE_OPTIONS).order_by(DeliveryZone.name)).all()
    return [serialize_delivery_zone(zone).model_dump() for zone in zones]


def _apply_zone_payload(zone: DeliveryZone, payload: DeliveryZoneWrite) -> None:
    zone.name = payload.name
    zone.description = payload.description
    zone.center_latitude = payload.center_latitude
    zone.center_longitude = payload.center_longitude
    zone.radius_km = payload.radius_km
    zone.is_active = payload.is_active
    zone.rates = [
        DeliveryZoneRate(
            vehicle_type=rate.vehicle_type,
            delivery_fee_customer=rate.delivery_fee_customer,
            rider_fee=rate.rider_fee,
        )
        for rate in payload.rates
    ]


@router.post("/delivery/zones", status_code=status.HTTP_201_CREATED)
def create_delivery_zone(
    payload: DeliveryZoneWrite,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    zone = DeliveryZone()
    _apply_zone_payload(zone, payload)
    db.add(zone)
    db.commit()
    db.refresh(zone)
    zone = db.scalar(select(DeliveryZone).options(*ZONE_OPTIONS).where(DeliveryZone.id == zone.id))
    assert zone is not None
    return serialize_delivery_zone(zone).model_dump()


@router.put("/delivery/zones/{zone_id}")
def update_delivery_zone(
    zone_id: int,
    payload: DeliveryZoneWrite,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    zone = db.scalar(select(DeliveryZone).options(*ZONE_OPTIONS).where(DeliveryZone.id == zone_id))
    if zone is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery zone not found")
    _apply_zone_payload(zone, payload)
    db.commit()
    db.refresh(zone)
    return serialize_delivery_zone(zone).model_dump()


@router.get("/delivery/dispatch")
def list_delivery_dispatch(
    _: User = Depends(require_admin), db: Session = Depends(get_db)
) -> list[dict[str, object]]:
    orders = db.scalars(
        select(StoreOrder)
        .options(*ORDER_OPTIONS)
        .where(StoreOrder.delivery_provider == "platform", StoreOrder.delivery_mode == "delivery")
        .order_by(StoreOrder.id.desc())
    ).all()
    return [serialize_order(order).model_dump() for order in orders]


@router.put("/delivery/dispatch/{order_id}/assign")
def assign_delivery_order(
    order_id: int,
    payload: DeliveryAssignRequest,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    order = db.scalar(
        select(StoreOrder).options(*ORDER_OPTIONS).where(StoreOrder.id == order_id)
    )
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    rider = db.scalar(
        select(User).where(User.id == payload.rider_user_id, User.role == "delivery")
    )
    if rider is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rider not found")

    rider_profile = db.get(DeliveryProfile, rider.id)
    if rider_profile is None or not rider_profile.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Rider profile is not active")

    assignment = ensure_assignment(db, order)
    if assignment is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Order is not handled by platform delivery")
    rider_profile.availability = "reserved"
    assignment.rider_user_id = rider.id
    assignment.zone_id = order.delivery_zone_id
    assignment.status = "assigned"
    assignment.accepted_at = datetime.now(UTC)
    assignment.vehicle_type_snapshot = rider_profile.vehicle_type
    order.assigned_rider_id = rider.id
    order.assigned_rider_name_snapshot = rider.full_name
    order.assigned_rider_phone_masked = mask_phone(rider_profile.phone)
    order.assigned_rider_vehicle_type = rider_profile.vehicle_type
    order.delivery_status = "assigned"
    create_notifications(
        db,
        user_ids=[order.user_id, order.store.owner_user_id, rider.id],
        order_id=order.id,
        event_type="delivery.admin_assigned",
        title="Pedido asignado",
        body=f"{rider.full_name} fue asignado al pedido.",
        payload={"order_id": order.id},
    )
    db.commit()
    db.refresh(order)
    publish_order_snapshot(order, event_type="delivery.admin_assigned")
    return serialize_order(order).model_dump()


@router.get("/delivery/settlements")
def list_delivery_settlements(
    _: User = Depends(require_admin), db: Session = Depends(get_db)
) -> list[dict[str, object]]:
    riders = db.scalars(select(DeliveryProfile).options(*RIDER_OPTIONS).order_by(DeliveryProfile.user_id)).all()
    results: list[dict[str, object]] = []
    for rider in riders:
        cash_liability_total = db.scalar(
            select(func.coalesce(func.sum(RiderSettlementCharge.amount), 0)).where(
                RiderSettlementCharge.rider_user_id == rider.user_id
            )
        )
        rider_fee_earned_total = db.scalar(
            select(func.coalesce(func.sum(StoreOrder.rider_fee), 0)).where(
                StoreOrder.assigned_rider_id == rider.user_id,
                StoreOrder.status == "delivered",
            )
        )
        rider_fee_paid_total = db.scalar(
            select(func.coalesce(func.sum(RiderSettlementPayment.amount), 0)).where(
                RiderSettlementPayment.rider_user_id == rider.user_id
            )
        )
        merchant_cash_payable_total = db.scalar(
            select(func.coalesce(func.sum(MerchantCashDeliveryPayable.amount), 0))
            .join(Store, Store.id == MerchantCashDeliveryPayable.store_id)
            .join(StoreOrder, StoreOrder.id == MerchantCashDeliveryPayable.order_id)
            .where(StoreOrder.assigned_rider_id == rider.user_id)
        )
        earned = float(rider_fee_earned_total or 0)
        paid = float(rider_fee_paid_total or 0)
        results.append(
            {
                "rider_user_id": rider.user_id,
                "rider_name": rider.user.full_name,
                "vehicle_type": rider.vehicle_type,
                "cash_liability_total": float(cash_liability_total or 0),
                "cash_liability_open": float(cash_liability_total or 0),
                "rider_fee_earned_total": earned,
                "rider_fee_paid_total": paid,
                "pending_amount": max(0.0, earned - paid),
                "merchant_cash_payable_total": float(merchant_cash_payable_total or 0),
            }
        )
    return results


@router.get("/delivery/settlements/payments", response_model=list[RiderSettlementPaymentRead])
def list_delivery_settlement_payments(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[RiderSettlementPaymentRead]:
    payments = db.scalars(
        select(RiderSettlementPayment)
        .options(*PAYMENT_OPTIONS)
        .order_by(RiderSettlementPayment.paid_at.desc(), RiderSettlementPayment.id.desc())
    ).all()
    return [serialize_rider_settlement_payment(payment) for payment in payments]


@router.post("/delivery/settlements/payments", status_code=status.HTTP_201_CREATED)
def create_delivery_settlement_payment(
    payload: DeliverySettlementPaymentCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    rider = db.scalar(select(User).where(User.id == payload.rider_user_id, User.role == "delivery"))
    if rider is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rider not found")
    rider_profile = db.get(DeliveryProfile, payload.rider_user_id)
    payment = RiderSettlementPayment(
        rider_user_id=payload.rider_user_id,
        store_id=rider_profile.store_id if rider_profile is not None else None,
        amount=payload.amount,
        paid_at=payload.paid_at,
        reference=payload.reference,
        notes=payload.notes,
        created_by_user_id=admin.id,
    )
    db.add(payment)
    db.flush()
    create_notifications(
        db,
        user_ids=[payload.rider_user_id],
        order_id=None,
        event_type="delivery.settlement_paid",
        title="Liquidacion registrada",
        body=f"Se registro un pago por ${payload.amount:.2f}.",
        payload={
            "amount": payload.amount,
            "payment_id": payment.id,
            "store_id": rider_profile.store_id if rider_profile is not None else None,
        },
    )
    db.commit()
    db.refresh(payment)
    return {
        "id": payment.id,
        "rider_user_id": payment.rider_user_id,
        "amount": float(payment.amount),
        "paid_at": payment.paid_at.isoformat(),
        "reference": payment.reference,
        "notes": payment.notes,
    }
