from __future__ import annotations

import os
import sys
import logging
import tempfile
from pathlib import Path
from typing import Any, Callable

DB_PATH = Path(tempfile.gettempdir()) / f"kepedimos_web_push_smoke_{os.getpid()}.db"
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


def configure_environment() -> None:
    os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
    os.environ["APP_ENV"] = "development"
    os.environ["SEED_DEMO_DATA"] = "false"
    os.environ["DELIVERY_EMBEDDED_WORKER"] = "false"
    os.environ["WEB_PUSH_VAPID_PUBLIC_KEY"] = "test-public-key"
    os.environ["WEB_PUSH_VAPID_PRIVATE_KEY"] = "test-private-key"
    os.environ["WEB_PUSH_VAPID_SUBJECT"] = "mailto:test@kepedimos.local"


def reset_database() -> None:
    import app.models  # noqa: F401
    from app.db.session import engine
    from app.models.delivery import NotificationEvent, PushSubscription
    from app.models.user import User

    engine.dispose()
    if DB_PATH.exists():
        DB_PATH.unlink()
    for table in (PushSubscription.__table__, NotificationEvent.__table__, User.__table__):
        table.drop(bind=engine, checkfirst=True)
    for table in (User.__table__, NotificationEvent.__table__, PushSubscription.__table__):
        table.create(bind=engine, checkfirst=True)
    engine.dispose()


def seed_notification(*, role: str = "customer", subscriptions: list[dict[str, Any]] | None = None) -> int:
    from app.db.session import SessionLocal
    from app.models.delivery import NotificationEvent, PushSubscription
    from app.models.user import User

    db = SessionLocal()
    try:
        user = User(
            full_name=f"Smoke {role}",
            email=f"smoke-{role}@kepedimos.local",
            hashed_password="smoke",
            role=role,
            is_active=True,
        )
        db.add(user)
        db.flush()
        notification = NotificationEvent(
            user_id=user.id,
            order_id=101,
            event_type="smoke.web_push",
            title="Pedido actualizado",
            body="Tu pedido tiene una novedad.",
            payload_json='{"order_id": 101}',
            push_status="queued",
        )
        db.add(notification)
        for item in subscriptions or []:
            db.add(PushSubscription(user_id=user.id, **item))
        db.commit()
        return notification.id
    finally:
        db.close()


def run_processor(
    *,
    expo_sender: Callable[[list[dict[str, Any]]], list[dict[str, Any]]] | None = None,
    web_sender: Callable[[Any, dict[str, Any]], None] | None = None,
) -> None:
    from app.db.session import SessionLocal
    from app.services import push_notifications

    original_expo_sender = push_notifications._send_expo_messages
    original_web_sender = push_notifications._send_web_push_notification
    if expo_sender is not None:
        push_notifications._send_expo_messages = expo_sender
    if web_sender is not None:
        push_notifications._send_web_push_notification = web_sender

    db = SessionLocal()
    try:
        processed = push_notifications.process_queued_push_notifications(db)
        assert processed == 1
        db.commit()
    finally:
        db.close()
        push_notifications._send_expo_messages = original_expo_sender
        push_notifications._send_web_push_notification = original_web_sender


def notification_status(notification_id: int) -> str:
    from app.db.session import SessionLocal
    from app.models.delivery import NotificationEvent

    db = SessionLocal()
    try:
        notification = db.get(NotificationEvent, notification_id)
        assert notification is not None
        return notification.push_status
    finally:
        db.close()


def assert_expo_only_subscription() -> None:
    reset_database()
    notification_id = seed_notification(
        subscriptions=[
            {
                "endpoint": "ExpoPushToken[expo-only]",
                "p256dh": "expo",
                "auth": "expo",
                "push_provider": "expo",
                "platform": "android",
            }
        ]
    )
    run_processor(expo_sender=lambda messages: [{"status": "ok"} for _ in messages])
    assert notification_status(notification_id) == "sent"


def assert_web_only_subscription() -> None:
    reset_database()
    web_payloads: list[dict[str, Any]] = []
    notification_id = seed_notification(
        subscriptions=[
            {
                "endpoint": "https://push.example.test/web-only",
                "p256dh": "p256dh",
                "auth": "auth",
                "push_provider": "web",
                "platform": "Windows",
            }
        ]
    )
    run_processor(web_sender=lambda _subscription, payload: web_payloads.append(payload))
    assert notification_status(notification_id) == "sent"
    assert web_payloads[0]["data"]["url"] == "/c/pedido/101"


def assert_mixed_subscriptions() -> None:
    reset_database()
    web_calls: list[dict[str, Any]] = []
    notification_id = seed_notification(
        role="merchant",
        subscriptions=[
            {
                "endpoint": "ExpoPushToken[mixed]",
                "p256dh": "expo",
                "auth": "expo",
                "push_provider": "expo",
                "platform": "android",
            },
            {
                "endpoint": "https://push.example.test/mixed",
                "p256dh": "p256dh",
                "auth": "auth",
                "push_provider": "web",
                "platform": "macOS",
            },
        ],
    )
    run_processor(
        expo_sender=lambda messages: [{"status": "ok"} for _ in messages],
        web_sender=lambda _subscription, payload: web_calls.append(payload),
    )
    assert notification_status(notification_id) == "sent"
    assert web_calls[0]["data"]["url"] == "/m/pedidos"


def assert_no_subscription() -> None:
    reset_database()
    notification_id = seed_notification()
    run_processor()
    assert notification_status(notification_id) == "no_subscription"


def assert_stale_web_subscription_is_disabled() -> None:
    reset_database()
    from app.services.push_notifications import WebPushDeliveryError

    notification_id = seed_notification(
        subscriptions=[
            {
                "endpoint": "https://push.example.test/stale",
                "p256dh": "p256dh",
                "auth": "auth",
                "push_provider": "web",
                "platform": "Linux",
            }
        ]
    )
    run_processor(web_sender=lambda _subscription, _payload: (_ for _ in ()).throw(WebPushDeliveryError("Gone", status_code=410)))
    assert notification_status(notification_id) == "failed"

    from app.db.session import SessionLocal
    from app.models.delivery import PushSubscription

    db = SessionLocal()
    try:
        subscription = db.query(PushSubscription).one()
        assert subscription.disabled_at is not None
        assert subscription.failure_count == 1
    finally:
        db.close()


def assert_web_failure_does_not_break_expo_success() -> None:
    reset_database()
    from app.services.push_notifications import WebPushDeliveryError

    notification_id = seed_notification(
        subscriptions=[
            {
                "endpoint": "ExpoPushToken[expo-still-ok]",
                "p256dh": "expo",
                "auth": "expo",
                "push_provider": "expo",
                "platform": "android",
            },
            {
                "endpoint": "https://push.example.test/misconfigured",
                "p256dh": "p256dh",
                "auth": "auth",
                "push_provider": "web",
                "platform": "iOS",
            },
        ]
    )
    run_processor(
        expo_sender=lambda messages: [{"status": "ok"} for _ in messages],
        web_sender=lambda _subscription, _payload: (_ for _ in ()).throw(
            WebPushDeliveryError("Web Push VAPID credentials are not configured")
        ),
    )
    assert notification_status(notification_id) == "sent_with_errors"


def main() -> None:
    logging.disable(logging.CRITICAL)
    configure_environment()
    assert_expo_only_subscription()
    assert_web_only_subscription()
    assert_mixed_subscriptions()
    assert_no_subscription()
    assert_stale_web_subscription_is_disabled()
    assert_web_failure_does_not_break_expo_success()
    print("Web Push notification smoke passed.")


if __name__ == "__main__":
    main()
