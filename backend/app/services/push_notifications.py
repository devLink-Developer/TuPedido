from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.models.delivery import NotificationEvent, PushSubscription

try:
    from pywebpush import WebPushException, webpush
except ImportError:  # pragma: no cover - keeps non-push local environments importable.
    WebPushException = None  # type: ignore[assignment]
    webpush = None

logger = logging.getLogger(__name__)

EXPO_PUSH_SEND_URL = "https://exp.host/--/api/v2/push/send"
EXPO_PUSH_TOKEN_PREFIXES = ("ExponentPushToken[", "ExpoPushToken[")
WEB_PUSH_TTL_SECONDS = 60 * 60


class WebPushDeliveryError(Exception):
    def __init__(self, message: str, *, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code

    @property
    def is_stale_subscription(self) -> bool:
        return self.status_code in {404, 410}


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


def _notification_payload(notification: NotificationEvent) -> dict[str, Any]:
    if not notification.payload_json:
        return {}
    try:
        payload = json.loads(notification.payload_json)
    except json.JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) else {}


def _role_home_url(role: str | None) -> str:
    return {
        "customer": "/c",
        "merchant": "/m",
        "delivery": "/r",
        "admin": "/a",
    }.get(role or "", "/")


def _notification_url(notification: NotificationEvent, role: str | None) -> str:
    payload = _notification_payload(notification)
    url = payload.get("url")
    if isinstance(url, str) and url.startswith("/"):
        return url

    if role == "customer" and notification.order_id is not None:
        return f"/c/pedido/{notification.order_id}"
    if role == "merchant" and notification.order_id is not None:
        return "/m/pedidos"
    if role == "delivery" and notification.order_id is not None:
        return "/r/pedidos"
    if role == "admin" and notification.order_id is not None:
        return "/a/pedidos"
    return _role_home_url(role)


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


def _build_web_push_payload(notification: NotificationEvent, role: str | None) -> dict[str, Any]:
    url = _notification_url(notification, role)
    data = _notification_data(notification)
    data["url"] = url
    data["role"] = role
    return {
        "title": notification.title or "Novedad de Kepedimos",
        "body": notification.body or "Tenes una actualizacion.",
        "icon": "/icons/app-icon-192.png",
        "badge": "/icons/app-icon-192.png",
        "tag": f"kepedimos-notification-{notification.id}",
        "data": data,
        "url": url,
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


def _subscription_provider(subscription: PushSubscription) -> str:
    provider = (subscription.push_provider or "").strip().lower()
    if provider == "expo" or is_expo_push_token(subscription.endpoint):
        return "expo"
    return "web"


def _web_push_subscription_info(subscription: PushSubscription) -> dict[str, Any]:
    return {
        "endpoint": subscription.endpoint,
        "keys": {
            "p256dh": subscription.p256dh,
            "auth": subscription.auth,
        },
    }


def _send_web_push_notification(subscription: PushSubscription, payload: dict[str, Any]) -> None:
    if webpush is None:
        raise WebPushDeliveryError("pywebpush is not installed")

    private_key = (settings.web_push_vapid_private_key or "").strip()
    subject = (settings.web_push_vapid_subject or "").strip()
    if not private_key or not subject:
        raise WebPushDeliveryError("Web Push VAPID credentials are not configured")

    try:
        webpush(
            subscription_info=_web_push_subscription_info(subscription),
            data=json.dumps(payload, ensure_ascii=False),
            vapid_private_key=private_key,
            vapid_claims={"sub": subject},
            ttl=WEB_PUSH_TTL_SECONDS,
            headers={"Urgency": "high"},
        )
    except Exception as exc:
        status_code = None
        if WebPushException is not None and isinstance(exc, WebPushException):
            response = getattr(exc, "response", None)
            status_code = getattr(response, "status_code", None)
        raise WebPushDeliveryError(str(exc), status_code=status_code) from exc


def _truncate_error(value: object, *, limit: int = 500) -> str:
    text = str(value)
    return text if len(text) <= limit else f"{text[: limit - 3]}..."


def _record_subscription_success(subscription: PushSubscription, attempted_at: datetime) -> None:
    subscription.last_attempted_at = attempted_at
    subscription.last_success_at = attempted_at
    subscription.last_failure_at = None
    subscription.last_failure_status = None
    subscription.failure_count = 0
    subscription.last_error = None


def _record_subscription_failure(
    subscription: PushSubscription,
    attempted_at: datetime,
    error: object,
    *,
    disable: bool = False,
) -> None:
    status_code = getattr(error, "status_code", None)
    subscription.last_attempted_at = attempted_at
    subscription.last_failure_at = attempted_at
    subscription.last_failure_status = status_code if isinstance(status_code, int) else None
    subscription.failure_count = (subscription.failure_count or 0) + 1
    subscription.last_error = _truncate_error(error)
    if disable:
        subscription.disabled_at = attempted_at


def _apply_push_status(notification: NotificationEvent, successes: int, failures: int) -> None:
    if successes <= 0 and failures <= 0:
        notification.push_status = "no_subscription"
    elif successes <= 0:
        notification.push_status = "failed"
    elif failures > 0:
        notification.push_status = "sent_with_errors"
    else:
        notification.push_status = "sent"


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
        attempted_at = datetime.now(UTC)
        notification.push_attempted_at = attempted_at
        subscriptions = db.scalars(
            select(PushSubscription)
            .options(selectinload(PushSubscription.user))
            .where(PushSubscription.user_id == notification.user_id, PushSubscription.disabled_at.is_(None))
            .order_by(PushSubscription.updated_at.desc(), PushSubscription.id.desc())
        ).all()
        if not subscriptions:
            notification.push_status = "no_subscription"
            continue

        successes = 0
        failures = 0
        expo_subscriptions = [item for item in subscriptions if _subscription_provider(item) == "expo"]
        web_subscriptions = [item for item in subscriptions if _subscription_provider(item) == "web"]

        expo_tokens = [subscription.endpoint.strip() for subscription in expo_subscriptions]
        if expo_tokens:
            try:
                results = _send_expo_messages([_build_expo_message(notification, token) for token in expo_tokens])
            except httpx.HTTPError as exc:
                failures += len(expo_subscriptions)
                for subscription in expo_subscriptions:
                    _record_subscription_failure(subscription, attempted_at, exc)
                logger.exception("Expo push delivery failed for notification %s", notification.id)
            else:
                if not results:
                    failures += len(expo_subscriptions)
                    for subscription in expo_subscriptions:
                        _record_subscription_failure(subscription, attempted_at, "Expo push returned no results")
                else:
                    for index, subscription in enumerate(expo_subscriptions):
                        result = results[index] if index < len(results) else {"status": "error", "message": "Missing Expo result"}
                        if result.get("status") == "ok":
                            successes += 1
                            _record_subscription_success(subscription, attempted_at)
                        else:
                            failures += 1
                            _record_subscription_failure(subscription, attempted_at, result)

        for subscription in web_subscriptions:
            role = getattr(subscription.user, "role", None)
            payload = _build_web_push_payload(notification, role)
            try:
                _send_web_push_notification(subscription, payload)
            except WebPushDeliveryError as exc:
                failures += 1
                _record_subscription_failure(
                    subscription,
                    attempted_at,
                    exc,
                    disable=exc.is_stale_subscription,
                )
                if exc.is_stale_subscription:
                    logger.info("Disabled stale Web Push subscription %s", subscription.id)
                else:
                    logger.warning("Web Push delivery failed for subscription %s: %s", subscription.id, exc)
            else:
                successes += 1
                _record_subscription_success(subscription, attempted_at)

        _apply_push_status(notification, successes, failures)
    if processed:
        db.flush()
    return processed
