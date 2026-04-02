from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.api.presenters import serialize_notification, serialize_order, serialize_tracking
from app.core.security import decode_access_token
from app.db.session import SessionLocal
from app.models.delivery import NotificationEvent
from app.models.order import StoreOrder
from app.models.user import User
from app.services.order_runtime import build_order_options
from app.services.realtime import realtime_hub

router = APIRouter()

TERMINAL_ORDER_STATUSES = {"delivered", "cancelled", "delivery_failed"}

def _order_options(db: Session) -> tuple[object, ...]:
    return build_order_options(
        db,
        selectinload(StoreOrder.items),
        selectinload(StoreOrder.store),
        selectinload(StoreOrder.address),
        selectinload(StoreOrder.delivery_assignment),
    )


def _latest_notifications(db: Session, user_id: int, *, limit: int = 20) -> list[dict[str, object]]:
    notifications = db.scalars(
        select(NotificationEvent)
        .where(NotificationEvent.user_id == user_id)
        .order_by(NotificationEvent.created_at.desc(), NotificationEvent.id.desc())
        .limit(limit)
    ).all()
    return [serialize_notification(item).model_dump() for item in notifications]


def _can_access_order(user: User, order: StoreOrder) -> bool:
    if user.role == "admin":
        return True
    if user.role == "customer":
        return order.user_id == user.id
    if user.role == "merchant":
        return order.store is not None and order.store.owner_user_id == user.id
    if user.role == "delivery":
        return order.assigned_rider_id == user.id or (
            order.delivery_assignment is not None and order.delivery_assignment.rider_user_id == user.id
        )
    return False


def _customer_can_track_order(order: StoreOrder) -> bool:
    return order.status not in TERMINAL_ORDER_STATUSES


def _get_user_from_token(token: str | None) -> User | None:
    if not token:
        return None
    subject = decode_access_token(token)
    if not subject:
        return None
    db = SessionLocal()
    try:
        return db.scalar(select(User).where(User.email == subject, User.is_active.is_(True)))
    finally:
        db.close()


@router.websocket("/ws/notifications/me")
async def notifications_me_socket(websocket: WebSocket) -> None:
    user = _get_user_from_token(websocket.query_params.get("token"))
    if user is None:
        await websocket.close(code=4401)
        return

    db = SessionLocal()
    try:
        await realtime_hub.connect_user(user.id, websocket)
        await websocket.send_json(
            {
                "type": "notifications.snapshot",
                "role": user.role,
                "notifications": _latest_notifications(db, user.id),
            }
        )
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await realtime_hub.disconnect(websocket)
    finally:
        db.close()


@router.websocket("/ws/orders/{order_id}")
async def order_tracking_socket(websocket: WebSocket, order_id: int) -> None:
    user = _get_user_from_token(websocket.query_params.get("token"))
    if user is None:
        await websocket.close(code=4401)
        return

    db = SessionLocal()
    try:
        order = db.scalar(select(StoreOrder).options(*_order_options(db)).where(StoreOrder.id == order_id))
        if order is None or not _can_access_order(user, order):
            await websocket.close(code=4404)
            return
        if user.role == "customer" and not _customer_can_track_order(order):
            await websocket.close(code=4404)
            return
        await realtime_hub.connect_order(order_id, websocket)
        tracking = serialize_tracking(order)
        if user.role not in {"customer", "delivery"}:
            tracking.otp_code = None
        await websocket.send_json(
            {
                "type": "order.snapshot",
                "order": serialize_order(order).model_dump(),
                "tracking": tracking.model_dump(),
            }
        )
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await realtime_hub.disconnect(websocket)
    finally:
        db.close()


@router.websocket("/ws/delivery/me")
async def delivery_me_socket(websocket: WebSocket) -> None:
    user = _get_user_from_token(websocket.query_params.get("token"))
    if user is None or user.role != "delivery":
        await websocket.close(code=4401)
        return

    db = SessionLocal()
    try:
        await realtime_hub.connect_user(user.id, websocket)
        await websocket.send_json(
            {
                "type": "delivery.snapshot",
                "notifications": _latest_notifications(db, user.id, limit=10),
            }
        )
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await realtime_hub.disconnect(websocket)
    finally:
        db.close()


@router.websocket("/ws/merchant/me")
async def merchant_me_socket(websocket: WebSocket) -> None:
    user = _get_user_from_token(websocket.query_params.get("token"))
    if user is None or user.role != "merchant":
        await websocket.close(code=4401)
        return

    db = SessionLocal()
    try:
        await realtime_hub.connect_user(user.id, websocket)
        await websocket.send_json(
            {
                "type": "merchant.connected",
                "notifications": _latest_notifications(db, user.id, limit=10),
            }
        )
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await realtime_hub.disconnect(websocket)
    finally:
        db.close()
