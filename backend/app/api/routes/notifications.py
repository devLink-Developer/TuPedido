from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user
from app.api.presenters import serialize_notification
from app.db.session import get_db
from app.models.delivery import NotificationEvent, PushSubscription
from app.models.user import User
from app.schemas.delivery import PushSubscriptionWrite

router = APIRouter()


@router.get("")
def list_notifications(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict[str, object]]:
    notifications = db.scalars(
        select(NotificationEvent)
        .where(NotificationEvent.user_id == user.id)
        .order_by(NotificationEvent.created_at.desc(), NotificationEvent.id.desc())
    ).all()
    return [serialize_notification(notification).model_dump() for notification in notifications]


@router.put("/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    notification = db.scalar(
        select(NotificationEvent).where(NotificationEvent.id == notification_id, NotificationEvent.user_id == user.id)
    )
    if notification is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return serialize_notification(notification).model_dump()


@router.post("/push-subscriptions", status_code=status.HTTP_201_CREATED)
def create_push_subscription(
    payload: PushSubscriptionWrite,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    endpoint = payload.endpoint.strip()
    p256dh = (payload.keys or {}).get("p256dh")
    auth = (payload.keys or {}).get("auth")
    if not endpoint or not p256dh or not auth:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid push subscription payload")

    subscription = db.scalar(select(PushSubscription).where(PushSubscription.endpoint == endpoint))
    if subscription is None:
        subscription = PushSubscription(
            user_id=user.id,
            endpoint=endpoint,
            p256dh=p256dh,
            auth=auth,
            user_agent=payload.user_agent,
        )
        db.add(subscription)
    else:
        subscription.user_id = user.id
        subscription.p256dh = p256dh
        subscription.auth = auth
        subscription.user_agent = payload.user_agent
    if user.role == "delivery" and user.delivery_profile is not None:
        user.delivery_profile.push_enabled = True
    db.commit()
    db.refresh(subscription)
    return {
        "id": subscription.id,
        "endpoint": subscription.endpoint,
        "created_at": subscription.created_at.isoformat() if subscription.created_at else None,
    }
