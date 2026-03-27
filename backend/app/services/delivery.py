from __future__ import annotations

import json
import secrets
from datetime import UTC, datetime, timedelta
from math import asin, cos, radians, sin, sqrt
from typing import Iterable

import anyio
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.presenters import serialize_order, serialize_tracking
from app.core.config import settings
from app.models.delivery import (
    DeliveryAssignment,
    DeliveryLocationPoint,
    DeliveryProfile,
    DeliveryZone,
    DeliveryZoneRate,
    NotificationEvent,
)
from app.models.order import StoreOrder
from app.models.store import Store
from app.models.user import Address, User
from app.services.realtime import realtime_hub
from app.services.settlements import create_cash_service_fee_charge

RIDER_VEHICLE_PRIORITY = ("motorcycle", "bicycle", "car")
TRACKING_VISIBLE_DELIVERY_STATUSES = {"assigned", "heading_to_store", "picked_up", "near_customer", "delivered"}


def as_float(value: object | None) -> float | None:
    if value is None:
        return None
    return float(value)


def mask_phone(phone: str | None) -> str | None:
    if not phone:
        return None
    digits = "".join(char for char in phone if char.isdigit())
    if len(digits) <= 4:
        return "*" * len(digits)
    return f"*** *** {digits[-4:]}"


def haversine_km(lat_a: float, lon_a: float, lat_b: float, lon_b: float) -> float:
    earth_radius = 6371.0
    lat_delta = radians(lat_b - lat_a)
    lon_delta = radians(lon_b - lon_a)
    sin_lat = sin(lat_delta / 2)
    sin_lon = sin(lon_delta / 2)
    a = sin_lat**2 + cos(radians(lat_a)) * cos(radians(lat_b)) * sin_lon**2
    return earth_radius * 2 * asin(sqrt(a))


def estimate_eta_minutes(distance_km: float | None, *, speed_kmh: float = 22) -> int | None:
    if distance_km is None:
        return None
    if distance_km <= 0:
        return 1
    return max(1, round((distance_km / max(speed_kmh, 1)) * 60))


def _user_ids_for_order(order: StoreOrder) -> list[int]:
    user_ids = [order.user_id]
    if getattr(order.store, "owner_user_id", None):
        user_ids.append(order.store.owner_user_id)
    if order.assigned_rider_id:
        user_ids.append(order.assigned_rider_id)
    return [user_id for user_id in dict.fromkeys(user_ids) if user_id is not None]


def publish_order_snapshot(order: StoreOrder, *, event_type: str) -> None:
    tracking = serialize_tracking(order)
    tracking.otp_code = None
    payload = {
        "type": event_type,
        "order": serialize_order(order).model_dump(),
        "tracking": tracking.model_dump(),
    }
    try:
        anyio.from_thread.run(realtime_hub.broadcast_order, order.id, payload)
        anyio.from_thread.run(realtime_hub.broadcast_users, _user_ids_for_order(order), payload)
    except RuntimeError:
        pass


def create_notifications(
    db: Session,
    *,
    user_ids: Iterable[int],
    order_id: int | None,
    event_type: str,
    title: str,
    body: str,
    payload: dict[str, object] | None = None,
) -> list[NotificationEvent]:
    notifications: list[NotificationEvent] = []
    payload_json = json.dumps(payload or {}, ensure_ascii=True)
    for user_id in dict.fromkeys(int(item) for item in user_ids):
        notification = NotificationEvent(
            user_id=user_id,
            order_id=order_id,
            event_type=event_type,
            title=title,
            body=body,
            payload_json=payload_json,
            push_status="queued",
        )
        db.add(notification)
        notifications.append(notification)
    db.flush()
    return notifications


def store_coordinates(store: Store) -> tuple[float | None, float | None]:
    return as_float(store.latitude), as_float(store.longitude)


def address_coordinates(address: Address | None) -> tuple[float | None, float | None]:
    if address is None:
        return None, None
    return as_float(address.latitude), as_float(address.longitude)


def ensure_platform_delivery_coordinates(store: Store, address: Address | None) -> None:
    store_latitude, store_longitude = store_coordinates(store)
    address_latitude, address_longitude = address_coordinates(address)
    if store_latitude is None or store_longitude is None:
        raise ValueError("Store coordinates are not configured for platform delivery")
    if address is not None and (address_latitude is None or address_longitude is None):
        raise ValueError("Address coordinates are required for platform delivery")


def select_zone_rate(zone: DeliveryZone, vehicle_type: str | None = None) -> DeliveryZoneRate | None:
    rates = list(zone.rates or [])
    if vehicle_type:
        exact = next((rate for rate in rates if rate.vehicle_type == vehicle_type), None)
        if exact is not None:
            return exact
    for preferred in RIDER_VEHICLE_PRIORITY:
        preferred_rate = next((rate for rate in rates if rate.vehicle_type == preferred), None)
        if preferred_rate is not None:
            return preferred_rate
    return rates[0] if rates else None


def resolve_delivery_zone(
    db: Session,
    *,
    store: Store,
    address: Address,
) -> tuple[DeliveryZone | None, DeliveryZoneRate | None]:
    ensure_platform_delivery_coordinates(store, address)
    store_latitude, store_longitude = store_coordinates(store)
    address_latitude, address_longitude = address_coordinates(address)
    assert store_latitude is not None
    assert store_longitude is not None
    assert address_latitude is not None
    assert address_longitude is not None

    zones = db.scalars(
        select(DeliveryZone)
        .options(selectinload(DeliveryZone.rates))
        .where(DeliveryZone.is_active.is_(True))
        .order_by(DeliveryZone.name)
    ).all()
    candidates: list[tuple[float, DeliveryZone]] = []
    for zone in zones:
        center_latitude = as_float(zone.center_latitude)
        center_longitude = as_float(zone.center_longitude)
        radius_km = as_float(zone.radius_km) or 0
        if center_latitude is None or center_longitude is None:
            continue
        store_distance = haversine_km(store_latitude, store_longitude, center_latitude, center_longitude)
        address_distance = haversine_km(address_latitude, address_longitude, center_latitude, center_longitude)
        if store_distance <= radius_km and address_distance <= radius_km:
            candidates.append((address_distance, zone))

    if not candidates:
        return None, None

    _, zone = min(candidates, key=lambda item: item[0])
    return zone, select_zone_rate(zone)


def snapshot_delivery_quote(
    db: Session,
    *,
    store: Store,
    address: Address | None,
    delivery_mode: str,
) -> dict[str, object]:
    if delivery_mode == "pickup":
        return {
            "provider": "pickup",
            "zone": None,
            "rate": None,
            "delivery_fee_customer": 0.0,
            "rider_fee": 0.0,
            "otp_required": False,
        }

    if address is None:
        raise ValueError("Address is required for delivery")

    zone, rate = resolve_delivery_zone(db, store=store, address=address)
    if zone is None:
        raise ValueError("No active delivery zone covers this store and address")

    return {
        "provider": "platform",
        "zone": zone,
        "rate": rate,
        "delivery_fee_customer": as_float(rate.delivery_fee_customer) if rate else 0.0,
        "rider_fee": as_float(rate.rider_fee) if rate else 0.0,
        "otp_required": True,
    }


def ensure_assignment(db: Session, order: StoreOrder) -> DeliveryAssignment | None:
    if order.delivery_provider != "platform" or order.delivery_mode != "delivery":
        return None
    assignment = db.scalar(
        select(DeliveryAssignment).where(DeliveryAssignment.order_id == order.id)
    )
    if assignment is None:
        assignment = DeliveryAssignment(
            order_id=order.id,
            zone_id=order.delivery_zone_id,
            status=order.delivery_status or "unassigned",
            otp_code=order.otp_code,
        )
        db.add(assignment)
        db.flush()
    return assignment


def _candidate_riders(
    db: Session,
    *,
    zone_id: int | None,
    exclude_user_ids: set[int] | None = None,
) -> list[DeliveryProfile]:
    exclude_user_ids = exclude_user_ids or set()
    query = (
        select(DeliveryProfile)
        .options(selectinload(DeliveryProfile.user))
        .where(
            DeliveryProfile.is_active.is_(True),
            DeliveryProfile.availability.in_(("idle", "paused")),
        )
    )
    if zone_id is not None:
        query = query.where(DeliveryProfile.current_zone_id == zone_id)
    if exclude_user_ids:
        query = query.where(DeliveryProfile.user_id.not_in(exclude_user_ids))
    return db.scalars(query.order_by(DeliveryProfile.last_location_at.desc().nullslast())).all()


def _distance_from_rider_to_store(rider: DeliveryProfile, store: Store) -> float:
    rider_latitude = as_float(rider.current_latitude)
    rider_longitude = as_float(rider.current_longitude)
    store_latitude, store_longitude = store_coordinates(store)
    if rider_latitude is None or rider_longitude is None or store_latitude is None or store_longitude is None:
        return 999999.0
    return haversine_km(rider_latitude, rider_longitude, store_latitude, store_longitude)


def offer_next_rider(db: Session, order: StoreOrder, *, exclude_user_ids: set[int] | None = None) -> DeliveryAssignment | None:
    if order.delivery_provider != "platform" or order.delivery_mode != "delivery":
        return None
    assignment = ensure_assignment(db, order)
    if assignment is None:
        return None

    if order.store is None:
        order.store = db.get(Store, order.store_id)
    riders = sorted(
        _candidate_riders(db, zone_id=order.delivery_zone_id, exclude_user_ids=exclude_user_ids),
        key=lambda rider: _distance_from_rider_to_store(rider, order.store),
    )
    if not riders:
        assignment.rider_user_id = None
        assignment.status = "assignment_pending"
        assignment.offer_expires_at = None
        order.delivery_status = "assignment_pending"
        db.flush()
        return assignment

    rider = riders[0]
    rider.availability = "reserved"
    assignment.rider_user_id = rider.user_id
    assignment.zone_id = order.delivery_zone_id
    assignment.status = "assignment_pending"
    assignment.vehicle_type_snapshot = rider.vehicle_type
    assignment.offer_expires_at = datetime.now(UTC) + timedelta(seconds=settings.delivery_offer_timeout_seconds)
    order.delivery_status = "assignment_pending"
    order.assigned_rider_id = rider.user_id
    order.assigned_rider_name_snapshot = rider.user.full_name
    order.assigned_rider_phone_masked = mask_phone(rider.phone)
    order.assigned_rider_vehicle_type = rider.vehicle_type
    create_notifications(
        db,
        user_ids=[rider.user_id],
        order_id=order.id,
        event_type="delivery.offer_created",
        title="Nuevo pedido disponible",
        body=f"{order.store_name_snapshot} listo para despacho.",
        payload={"order_id": order.id},
    )
    db.flush()
    return assignment


def accept_delivery_offer(db: Session, *, order: StoreOrder, rider: User) -> DeliveryAssignment:
    assignment = ensure_assignment(db, order)
    if assignment is None or assignment.rider_user_id != rider.id:
        raise ValueError("This order is not assigned to the current rider")
    rider_profile = db.get(DeliveryProfile, rider.id)
    if rider_profile is None:
        raise ValueError("Delivery profile not found")

    assignment.status = "assigned"
    assignment.accepted_at = datetime.now(UTC)
    order.delivery_status = "assigned"
    order.assigned_rider_id = rider.id
    order.assigned_rider_name_snapshot = rider.full_name
    order.assigned_rider_phone_masked = mask_phone(rider_profile.phone)
    order.assigned_rider_vehicle_type = rider_profile.vehicle_type
    rider_profile.availability = "reserved"
    create_notifications(
        db,
        user_ids=[order.user_id, order.store.owner_user_id],
        order_id=order.id,
        event_type="delivery.assigned",
        title="Repartidor asignado",
        body=f"{rider.full_name} va camino al comercio.",
        payload={"order_id": order.id, "rider_name": rider.full_name},
    )
    db.flush()
    return assignment


def mark_order_ready_for_dispatch(db: Session, order: StoreOrder) -> DeliveryAssignment | None:
    order.status = "ready_for_dispatch"
    order.delivery_status = "assignment_pending"
    order.merchant_ready_at = datetime.now(UTC)
    assignment = offer_next_rider(db, order)
    create_notifications(
        db,
        user_ids=[order.user_id],
        order_id=order.id,
        event_type="order.ready_for_dispatch",
        title="Pedido listo para despacho",
        body=f"{order.store_name_snapshot} ya tiene tu pedido listo para retirar.",
        payload={"order_id": order.id},
    )
    db.flush()
    return assignment


def rider_pick_up_order(db: Session, *, order: StoreOrder, rider: User) -> DeliveryAssignment:
    assignment = ensure_assignment(db, order)
    if assignment is None or assignment.rider_user_id != rider.id:
        raise ValueError("This order is not assigned to the current rider")
    rider_profile = db.get(DeliveryProfile, rider.id)
    if rider_profile is None:
        raise ValueError("Delivery profile not found")

    assignment.status = "picked_up"
    assignment.picked_up_at = datetime.now(UTC)
    order.status = "out_for_delivery"
    order.delivery_status = "picked_up"
    order.out_for_delivery_at = datetime.now(UTC)
    rider_profile.availability = "delivering"
    create_notifications(
        db,
        user_ids=[order.user_id, order.store.owner_user_id],
        order_id=order.id,
        event_type="delivery.picked_up",
        title="Pedido en camino",
        body=f"{rider.full_name} retiró el pedido y ya va hacia el destino.",
        payload={"order_id": order.id},
    )
    db.flush()
    return assignment


def rider_deliver_order(db: Session, *, order: StoreOrder, rider: User, otp_code: str | None) -> DeliveryAssignment:
    assignment = ensure_assignment(db, order)
    if assignment is None or assignment.rider_user_id != rider.id:
        raise ValueError("This order is not assigned to the current rider")
    rider_profile = db.get(DeliveryProfile, rider.id)
    if rider_profile is None:
        raise ValueError("Delivery profile not found")
    if order.otp_required and order.otp_code and order.otp_code != (otp_code or "").strip():
        raise ValueError("Invalid delivery OTP")

    now = datetime.now(UTC)
    assignment.status = "delivered"
    assignment.delivered_at = now
    assignment.otp_verified_at = now
    order.status = "delivered"
    order.delivery_status = "delivered"
    order.otp_verified_at = now
    order.delivered_at = now
    order.payment_status = "approved" if order.payment_method == "cash" else order.payment_status
    rider_profile.availability = "idle"
    rider_profile.completed_deliveries = (rider_profile.completed_deliveries or 0) + 1
    create_notifications(
        db,
        user_ids=[order.user_id, order.store.owner_user_id],
        order_id=order.id,
        event_type="order.delivered",
        title="Pedido entregado",
        body=f"{rider.full_name} confirmó la entrega.",
        payload={"order_id": order.id},
    )
    finalize_delivery_financials(db, order)
    db.flush()
    return assignment


def sync_delivery_location(
    db: Session,
    *,
    order: StoreOrder,
    rider: User,
    latitude: float,
    longitude: float,
    heading: float | None,
    speed_kmh: float | None,
    accuracy_meters: float | None,
) -> DeliveryAssignment:
    assignment = ensure_assignment(db, order)
    if assignment is None or assignment.rider_user_id != rider.id:
        raise ValueError("This order is not assigned to the current rider")
    rider_profile = db.get(DeliveryProfile, rider.id)
    if rider_profile is None:
        raise ValueError("Delivery profile not found")

    now = datetime.now(UTC)
    assignment.current_latitude = latitude
    assignment.current_longitude = longitude
    assignment.current_heading = heading
    assignment.current_speed_kmh = speed_kmh
    assignment.last_heartbeat_at = now
    assignment.tracking_stale = False

    rider_profile.current_latitude = latitude
    rider_profile.current_longitude = longitude
    rider_profile.last_location_at = now
    order.tracking_last_latitude = latitude
    order.tracking_last_longitude = longitude
    order.tracking_last_at = now
    order.tracking_stale = False

    target_latitude: float | None = None
    target_longitude: float | None = None
    if assignment.picked_up_at is None:
        target_latitude, target_longitude = store_coordinates(order.store)
        order.delivery_status = "heading_to_store" if order.delivery_status in {"assigned", "assignment_pending"} else order.delivery_status
    else:
        target_latitude, target_longitude = address_coordinates(order.address)
        if target_latitude is not None and target_longitude is not None:
            distance_km = haversine_km(latitude, longitude, target_latitude, target_longitude)
            if distance_km <= 0.35 and assignment.status not in {"near_customer", "delivered"}:
                assignment.near_customer_at = now
                assignment.status = "near_customer"
                order.delivery_status = "near_customer"

    distance_km = None
    if target_latitude is not None and target_longitude is not None:
        distance_km = haversine_km(latitude, longitude, target_latitude, target_longitude)

    assignment.distance_km = distance_km
    assignment.last_eta_minutes = estimate_eta_minutes(distance_km, speed_kmh=speed_kmh or 22)
    order.eta_minutes = assignment.last_eta_minutes

    db.add(
        DeliveryLocationPoint(
            assignment_id=assignment.id,
            latitude=latitude,
            longitude=longitude,
            heading=heading,
            speed_kmh=speed_kmh,
            accuracy_meters=accuracy_meters,
        )
    )
    db.flush()
    return assignment


def finalize_delivery_financials(db: Session, order: StoreOrder) -> None:
    if order.payment_method != "cash":
        return
    create_cash_service_fee_charge(db, order)


def expire_pending_offers(db: Session) -> int:
    now = datetime.now(UTC)
    assignments = db.scalars(
        select(DeliveryAssignment)
        .options(selectinload(DeliveryAssignment.order).selectinload(StoreOrder.store))
        .where(
            DeliveryAssignment.status == "assignment_pending",
            DeliveryAssignment.offer_expires_at.is_not(None),
            DeliveryAssignment.offer_expires_at <= now,
        )
    ).all()
    processed = 0
    for assignment in assignments:
        processed += 1
        previous_rider_id = assignment.rider_user_id
        if previous_rider_id is not None:
            previous_profile = db.get(DeliveryProfile, previous_rider_id)
            if previous_profile is not None and previous_profile.availability == "reserved":
                previous_profile.availability = "idle"
        order = assignment.order
        assignment.rider_user_id = None
        assignment.offer_expires_at = None
        assignment.status = "unassigned"
        offer_next_rider(db, order, exclude_user_ids={previous_rider_id} if previous_rider_id else None)
        create_notifications(
            db,
            user_ids=[order.user_id, order.store.owner_user_id],
            order_id=order.id,
            event_type="delivery.reassigning",
            title="Buscando nuevo repartidor",
            body="El pedido sigue en proceso de asignacion.",
            payload={"order_id": order.id},
        )
    if processed:
        db.flush()
    return processed


def mark_stale_tracking(db: Session) -> int:
    stale_before = datetime.now(UTC) - timedelta(seconds=settings.delivery_tracking_stale_seconds)
    assignments = db.scalars(
        select(DeliveryAssignment)
        .options(selectinload(DeliveryAssignment.order))
        .where(
            DeliveryAssignment.last_heartbeat_at.is_not(None),
            DeliveryAssignment.last_heartbeat_at <= stale_before,
            DeliveryAssignment.status.in_(("assigned", "heading_to_store", "picked_up", "near_customer")),
            DeliveryAssignment.tracking_stale.is_(False),
        )
    ).all()
    processed = 0
    for assignment in assignments:
        processed += 1
        assignment.tracking_stale = True
        assignment.order.tracking_stale = True
    if processed:
        db.flush()
    return processed


def bootstrap_delivery_order(db: Session, order: StoreOrder) -> None:
    if order.delivery_provider == "platform" and order.delivery_mode == "delivery":
        ensure_assignment(db, order)
    db.flush()
