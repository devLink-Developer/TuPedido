from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user
from app.api.presenters import serialize_notification
from app.db.session import get_db
from app.models.delivery import NotificationEvent, PushSubscription
from app.models.user import User
from app.core.config import settings
from app.schemas.delivery import PushSubscriptionDelete, PushSubscriptionWrite
from app.services.push_notifications import is_expo_push_token

router = APIRouter()


@router.get("")
def list_notifications(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict[str, object]]:
    notifications = db.scalars(
        select(NotificationEvent)
        .where(NotificationEvent.user_id == user.id)
        .order_by(NotificationEvent.created_at.desc(), NotificationEvent.id.desc())
    ).all()
    return [serialize_notification(notification).model_dump() for notification in notifications]


@router.get("/web-push/public-key")
def get_web_push_public_key() -> dict[str, object]:
    public_key = (settings.web_push_vapid_public_key or "").strip()
    return {"public_key": public_key or None, "enabled": bool(public_key)}


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


@router.put("/read-all")
def mark_all_notifications_read(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict[str, object]]:
    notifications = db.scalars(
        select(NotificationEvent)
        .where(NotificationEvent.user_id == user.id)
        .order_by(NotificationEvent.created_at.desc(), NotificationEvent.id.desc())
    ).all()
    for notification in notifications:
        notification.is_read = True
    db.commit()
    return [serialize_notification(notification).model_dump() for notification in notifications]


@router.post("/push-subscriptions", status_code=status.HTTP_201_CREATED)
def create_push_subscription(
    payload: PushSubscriptionWrite,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    endpoint = (payload.push_token or payload.endpoint or "").strip()
    keys = payload.keys or {}
    p256dh = keys.get("p256dh")
    auth = keys.get("auth")
    provider = (payload.push_provider or "").strip().lower()
    if not provider:
        provider = "expo" if is_expo_push_token(endpoint) else "web"
    if provider not in {"expo", "web"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported push provider")

    if provider == "expo":
        if not is_expo_push_token(endpoint):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Expo push token")
        p256dh = p256dh or "expo"
        auth = auth or "expo"
    elif is_expo_push_token(endpoint):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid web push subscription")
    if not endpoint or not p256dh or not auth:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid push subscription payload")

    subscription = db.scalar(select(PushSubscription).where(PushSubscription.endpoint == endpoint))
    if subscription is None:
        subscription = PushSubscription(
            user_id=user.id,
            endpoint=endpoint,
            p256dh=p256dh,
            auth=auth,
            push_provider=provider,
            platform=payload.platform,
            user_agent=payload.user_agent,
        )
        db.add(subscription)
    else:
        subscription.user_id = user.id
        subscription.p256dh = p256dh
        subscription.auth = auth
        subscription.push_provider = provider
        subscription.platform = payload.platform
        subscription.user_agent = payload.user_agent
        subscription.disabled_at = None
        subscription.failure_count = 0
        subscription.last_failure_at = None
        subscription.last_failure_status = None
        subscription.last_error = None
    if user.role == "delivery" and user.delivery_profile is not None:
        user.delivery_profile.push_enabled = True
    db.commit()
    db.refresh(subscription)
    return {
        "id": subscription.id,
        "endpoint": subscription.endpoint,
        "push_provider": subscription.push_provider,
        "platform": subscription.platform,
        "disabled_at": subscription.disabled_at.isoformat() if subscription.disabled_at else None,
        "created_at": subscription.created_at.isoformat() if subscription.created_at else None,
    }


@router.delete("/push-subscriptions")
def delete_push_subscription(
    payload: PushSubscriptionDelete,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    endpoint = payload.endpoint.strip()
    if not endpoint:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid push subscription payload")

    subscription = db.scalar(
        select(PushSubscription).where(PushSubscription.endpoint == endpoint, PushSubscription.user_id == user.id)
    )
    if subscription is None:
        return {"deleted": False}

    db.delete(subscription)
    db.flush()
    if user.role == "delivery" and user.delivery_profile is not None:
        has_subscription = db.scalar(
            select(PushSubscription.id)
            .where(PushSubscription.user_id == user.id, PushSubscription.disabled_at.is_(None))
            .limit(1)
        )
        user.delivery_profile.push_enabled = has_subscription is not None
    db.commit()
    return {"deleted": True}
