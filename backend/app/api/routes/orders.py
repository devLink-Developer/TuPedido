from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.exc import IntegrityError

from app.api.deps import get_current_user, require_customer
from app.api.presenters import serialize_order, serialize_tracking
from app.db.session import get_db
from app.models.order import OrderReview, StoreOrder
from app.models.user import User
from app.schemas.order import OrderRead, OrderReviewCreate, OrderTrackingRead, PendingOrderReviewRead
from app.services.order_runtime import build_order_options
from app.services.order_reviews import (
    find_oldest_pending_review_order,
    normalize_review_text,
    recalculate_rider_rating,
    recalculate_store_rating,
    requires_rider_rating,
)

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


@router.get("", response_model=list[OrderRead])
def list_orders(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[OrderRead]:
    orders = db.scalars(
        select(StoreOrder)
        .options(*_order_options(db))
        .where(StoreOrder.user_id == user.id)
        .order_by(StoreOrder.id.desc())
    ).all()
    return [serialize_order(order) for order in orders]


@router.get("/pending-review", response_model=PendingOrderReviewRead | None)
def get_pending_review(
    user: User = Depends(require_customer),
    db: Session = Depends(get_db),
) -> PendingOrderReviewRead | None:
    order = find_oldest_pending_review_order(db, user_id=user.id)
    if order is None:
        return None

    return PendingOrderReviewRead(
        order_id=order.id,
        store_name=order.store_name_snapshot,
        delivered_at=order.delivered_at,
        rider_name=order.assigned_rider_name_snapshot,
        requires_rider_rating=requires_rider_rating(order),
    )


@router.post("/{order_id}/review", status_code=status.HTTP_204_NO_CONTENT)
def create_order_review(
    order_id: int,
    payload: OrderReviewCreate,
    user: User = Depends(require_customer),
    db: Session = Depends(get_db),
) -> Response:
    order = db.scalar(select(StoreOrder).where(StoreOrder.id == order_id))
    if order is None or order.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if order.status != "delivered":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Order is not delivered")
    if not order.review_prompt_enabled:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Order review is not enabled")
    if db.scalar(select(OrderReview.id).where(OrderReview.order_id == order.id)) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Order review already exists")

    rider_rating_required = requires_rider_rating(order)
    if rider_rating_required and payload.rider_rating is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Rider rating is required")
    if not rider_rating_required and payload.rider_rating is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Rider rating is not applicable")

    db.add(
        OrderReview(
            order_id=order.id,
            user_id=user.id,
            store_id=order.store_id,
            rider_user_id=order.assigned_rider_id,
            store_rating=payload.store_rating,
            rider_rating=payload.rider_rating if rider_rating_required else None,
            review_text=normalize_review_text(payload.review_text),
        )
    )

    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Order review already exists") from exc

    recalculate_store_rating(db, store_id=order.store_id)
    if order.assigned_rider_id is not None:
        recalculate_rider_rating(db, rider_user_id=order.assigned_rider_id)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{order_id}", response_model=OrderRead)
def get_order(order_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> OrderRead:
    order = db.scalar(
        select(StoreOrder)
        .options(*_order_options(db))
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
    order = db.scalar(select(StoreOrder).options(*_order_options(db)).where(StoreOrder.id == order_id))
    if order is None or not _can_access_order(user, order):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if user.role == "customer" and not _customer_can_track_order(order):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order tracking not available")
    tracking = serialize_tracking(order)
    if user.role not in {"customer", "delivery"}:
        tracking.otp_code = None
    return tracking
