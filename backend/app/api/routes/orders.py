from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user
from app.api.presenters import serialize_order, serialize_tracking
from app.db.session import get_db
from app.models.order import StoreOrder
from app.models.user import User
from app.schemas.order import OrderRead, OrderTrackingRead

router = APIRouter()


ORDER_OPTIONS = (
    selectinload(StoreOrder.items),
    selectinload(StoreOrder.store),
    selectinload(StoreOrder.address),
    selectinload(StoreOrder.delivery_assignment),
)


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


@router.get("", response_model=list[OrderRead])
def list_orders(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[OrderRead]:
    orders = db.scalars(
        select(StoreOrder)
        .options(*ORDER_OPTIONS)
        .where(StoreOrder.user_id == user.id)
        .order_by(StoreOrder.id.desc())
    ).all()
    return [serialize_order(order) for order in orders]


@router.get("/{order_id}", response_model=OrderRead)
def get_order(order_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> OrderRead:
    order = db.scalar(
        select(StoreOrder)
        .options(*ORDER_OPTIONS)
        .where(StoreOrder.id == order_id)
    )
    if order is None or not _can_access_order(user, order):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    return serialize_order(order)


@router.get("/{order_id}/tracking", response_model=OrderTrackingRead)
def get_order_tracking(
    order_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OrderTrackingRead:
    order = db.scalar(select(StoreOrder).options(*ORDER_OPTIONS).where(StoreOrder.id == order_id))
    if order is None or not _can_access_order(user, order):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    tracking = serialize_tracking(order)
    if user.role not in {"customer", "delivery"}:
        tracking.otp_code = None
    return tracking
