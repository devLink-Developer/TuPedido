from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.delivery import NotificationEvent, PushSubscription

logger = logging.getLogger(__name__)

EXPO_PUSH_SEND_URL = "https://exp.host/--/api/v2/push/send"
EXPO_PUSH_TOKEN_PREFIXES = ("ExponentPushToken[", "ExpoPushToken[")


def is_expo_push_token(value: str | None) -> bool:
    token = (value or "").strip()
    return token.startswith(EXPO_PUSH_TOKEN_PREFIXES) and token.endswith("]")


def _notification_data(notification: NotificationEvent) -> dict[str, Any]:
    data: dict[str, Any] = {
        "notificationId": notification.id,
        "eventType": notification.event_type,
    }
    if notification.order_id is not None:
        data["orderId"] = notification.order_id
    if notification.payload_json:
        try:
            payload = json.loads(notification.payload_json)
        except json.JSONDecodeError:
            payload = None
        if isinstance(payload, dict):
            data["payload"] = payload
    return data


def _build_expo_message(notification: NotificationEvent, token: str) -> dict[str, Any]:
    return {
        "to": token,
        "sound": "default",
        "title": notification.title,
        "body": notification.body,
        "data": _notification_data(notification),
        "channelId": "kepedimos-orders",
        "priority": "high",
    }


def _send_expo_messages(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not messages:
        return []
    payload: dict[str, Any] | list[dict[str, Any]] = messages[0] if len(messages) == 1 else messages
    with httpx.Client(timeout=10.0, follow_redirects=True) as client:
        response = client.post(EXPO_PUSH_SEND_URL, json=payload)
        response.raise_for_status()
        response_payload = response.json()
    data = response_payload.get("data") if isinstance(response_payload, dict) else None
    if isinstance(data, dict):
        return [data]
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]
    return []


def process_queued_push_notifications(db: Session, *, limit: int = 50) -> int:
    notifications = db.scalars(
        select(NotificationEvent)
        .where(NotificationEvent.push_status == "queued")
        .order_by(NotificationEvent.created_at.asc(), NotificationEvent.id.asc())
        .limit(limit)
    ).all()
    processed = 0
    for notification in notifications:
        processed += 1
        notification.push_attempted_at = datetime.now(UTC)
        subscriptions = db.scalars(
            select(PushSubscription)
            .where(PushSubscription.user_id == notification.user_id)
            .order_by(PushSubscription.updated_at.desc(), PushSubscription.id.desc())
        ).all()
        expo_tokens = [subscription.endpoint.strip() for subscription in subscriptions if is_expo_push_token(subscription.endpoint)]
        if not expo_tokens:
            notification.push_status = "no_subscription"
            continue

        try:
            results = _send_expo_messages([_build_expo_message(notification, token) for token in expo_tokens])
        except httpx.HTTPError:
            notification.push_status = "failed"
            logger.exception("Expo push delivery failed for notification %s", notification.id)
            continue

        if not results:
            notification.push_status = "failed"
            continue
        failures = [item for item in results if item.get("status") != "ok"]
        if failures and len(failures) == len(results):
            notification.push_status = "failed"
        elif failures:
            notification.push_status = "sent_with_errors"
        else:
            notification.push_status = "sent"
    if processed:
        db.flush()
    return processed
