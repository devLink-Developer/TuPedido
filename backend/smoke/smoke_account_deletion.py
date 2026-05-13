from __future__ import annotations

import os
import sys
from datetime import UTC, datetime
from pathlib import Path

DB_PATH = Path(__file__).with_name("smoke_account_deletion.db")
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


def configure_environment() -> None:
    os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
    os.environ["APP_ENV"] = "development"
    os.environ["SEED_DEMO_DATA"] = "true"
    os.environ["FRONTEND_BASE_URL"] = "http://localhost:8015"
    os.environ["BACKEND_BASE_URL"] = "http://localhost:8016"
    os.environ["DELIVERY_EMBEDDED_WORKER"] = "false"
    os.environ["MERCADOPAGO_SIMULATED"] = "true"


def _login(client, email: str, password: str) -> dict[str, str]:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    response.raise_for_status()
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _seed_customer_deletion_data() -> dict[str, int]:
    from app.db.session import SessionLocal
    from app.models.delivery import NotificationEvent, PushSubscription
    from app.models.order import OrderReview, ShoppingCart, StoreOrder
    from app.models.store import Store
    from app.models.user import Address, User

    db = SessionLocal()
    try:
        customer = db.query(User).filter(User.email == "cliente@kepedimos.example.com").one()
        merchant = db.query(User).filter(User.email == "merchant@kepedimos.example.com").one()
        store = db.query(Store).filter(Store.owner_user_id == merchant.id).one()
        address = db.query(Address).filter(Address.user_id == customer.id).first()
        if address is None:
            raise AssertionError("Expected seeded customer address")

        if customer.cart is None:
            db.add(
                ShoppingCart(
                    user_id=customer.id,
                    store_id=store.id,
                    delivery_mode="delivery",
                    subtotal=1200,
                    delivery_fee=350,
                    total=1550,
                )
            )

        db.add(
            NotificationEvent(
                user_id=customer.id,
                event_type="smoke.account_deletion",
                title="Smoke",
                body="Debe borrarse al eliminar la cuenta.",
            )
        )
        db.add(
            PushSubscription(
                user_id=customer.id,
                endpoint="ExponentPushToken[account-deletion-customer]",
                p256dh="expo",
                auth="expo",
                user_agent="smoke",
            )
        )

        order = StoreOrder(
            user_id=customer.id,
            store_id=store.id,
            address_id=address.id,
            delivery_mode="delivery",
            payment_method="cash",
            payment_status="approved",
            customer_name_snapshot=customer.full_name,
            store_name_snapshot=store.name,
            store_slug_snapshot=store.slug,
            store_address_snapshot=store.address,
            address_label_snapshot=address.label,
            address_full_snapshot=f"{address.street} {address.details}",
            subtotal=1200,
            commercial_discount_total=0,
            financial_discount_total=0,
            delivery_fee=350,
            service_fee=0,
            delivery_fee_customer=350,
            rider_fee=200,
            total=1550,
            status="delivered",
            delivery_status="delivered",
            delivery_provider="platform",
            otp_required=False,
            review_prompt_enabled=True,
        )
        db.add(order)
        db.flush()
        db.add(
            OrderReview(
                order_id=order.id,
                user_id=customer.id,
                store_id=store.id,
                rider_user_id=None,
                store_rating=5,
                review_text="Texto personal a anonimizar.",
            )
        )

        db.commit()
        return {"user_id": customer.id, "order_id": order.id}
    finally:
        db.close()


def _assert_customer_deleted(user_id: int, order_id: int) -> None:
    from app.db.session import SessionLocal
    from app.models.delivery import NotificationEvent, PushSubscription
    from app.models.order import OrderReview, ShoppingCart, StoreOrder
    from app.models.user import Address, User

    db = SessionLocal()
    try:
        user = db.get(User, user_id)
        assert user is not None
        assert user.email == f"deleted-user-{user_id}@deleted.kepedimos.local"
        assert user.full_name == "Cuenta eliminada"
        assert user.is_active is False

        assert db.query(Address).filter(Address.user_id == user_id).count() == 0
        assert db.query(ShoppingCart).filter(ShoppingCart.user_id == user_id).count() == 0
        assert db.query(NotificationEvent).filter(NotificationEvent.user_id == user_id).count() == 0
        assert db.query(PushSubscription).filter(PushSubscription.user_id == user_id).count() == 0

        order = db.get(StoreOrder, order_id)
        assert order is not None
        assert order.customer_name_snapshot == "Cuenta eliminada"
        assert order.address_id is None
        assert order.address_label_snapshot is None
        assert order.address_full_snapshot is None
        assert order.review_prompt_enabled is False

        review = db.query(OrderReview).filter(OrderReview.order_id == order_id).one()
        assert review.review_text is None
    finally:
        db.close()


def _seed_delivery_deletion_data() -> dict[str, int]:
    from app.core.security import hash_password
    from app.db.session import SessionLocal
    from app.models.delivery import DeliveryAssignment, NotificationEvent, PushSubscription
    from app.models.order import OrderReview, StoreOrder
    from app.models.store import Store
    from app.models.user import User

    db = SessionLocal()
    try:
        rider = db.query(User).filter(User.email == "delivery@kepedimos.example.com").one()
        merchant = db.query(User).filter(User.email == "merchant@kepedimos.example.com").one()
        store = db.query(Store).filter(Store.owner_user_id == merchant.id).one()

        customer = User(
            full_name="Smoke Cliente Entrega",
            email="smoke.delivery.customer@example.com",
            hashed_password=hash_password("smoke123"),
            role="customer",
            is_active=True,
        )
        db.add(customer)
        db.flush()

        order = StoreOrder(
            user_id=customer.id,
            store_id=store.id,
            address_id=None,
            delivery_mode="delivery",
            payment_method="cash",
            payment_status="approved",
            customer_name_snapshot=customer.full_name,
            store_name_snapshot=store.name,
            store_slug_snapshot=store.slug,
            store_address_snapshot=store.address,
            address_label_snapshot="Smoke",
            address_full_snapshot="Smoke 123",
            subtotal=1800,
            commercial_discount_total=0,
            financial_discount_total=0,
            delivery_fee=350,
            service_fee=0,
            delivery_fee_customer=350,
            rider_fee=200,
            total=2150,
            status="out_for_delivery",
            delivery_status="picked_up",
            delivery_provider="platform",
            assigned_rider_id=rider.id,
            assigned_rider_name_snapshot=rider.full_name,
            assigned_rider_phone_masked="***1234",
            assigned_rider_vehicle_type="motorcycle",
            tracking_last_latitude=-34.5615,
            tracking_last_longitude=-58.4555,
            tracking_last_at=datetime.now(UTC),
            tracking_stale=False,
            otp_required=False,
            review_prompt_enabled=True,
        )
        db.add(order)
        db.flush()

        assignment = DeliveryAssignment(
            order_id=order.id,
            rider_user_id=rider.id,
            status="accepted",
            vehicle_type_snapshot="motorcycle",
            current_latitude=-34.5615,
            current_longitude=-58.4555,
            current_heading=90,
            current_speed_kmh=28,
            last_heartbeat_at=datetime.now(UTC),
            tracking_stale=False,
        )
        db.add(assignment)

        db.add(
            OrderReview(
                order_id=order.id,
                user_id=customer.id,
                store_id=store.id,
                rider_user_id=rider.id,
                store_rating=4,
                rider_rating=5,
                review_text="Entrega con datos de rider.",
            )
        )
        db.add(
            NotificationEvent(
                user_id=rider.id,
                order_id=order.id,
                event_type="smoke.rider_deletion",
                title="Smoke",
                body="Debe borrarse al eliminar el repartidor.",
            )
        )
        db.add(
            PushSubscription(
                user_id=rider.id,
                endpoint="ExponentPushToken[account-deletion-rider]",
                p256dh="expo",
                auth="expo",
                user_agent="smoke",
            )
        )

        db.commit()
        return {"user_id": rider.id, "order_id": order.id, "assignment_id": assignment.id}
    finally:
        db.close()


def _assert_delivery_deleted(user_id: int, order_id: int, assignment_id: int) -> None:
    from app.db.session import SessionLocal
    from app.models.delivery import (
        DeliveryApplication,
        DeliveryAssignment,
        DeliveryProfile,
        NotificationEvent,
        PushSubscription,
    )
    from app.models.order import OrderReview, StoreOrder
    from app.models.user import Address, User

    db = SessionLocal()
    try:
        user = db.get(User, user_id)
        assert user is not None
        assert user.email == f"deleted-user-{user_id}@deleted.kepedimos.local"
        assert user.full_name == "Cuenta eliminada"
        assert user.is_active is False

        assert db.query(Address).filter(Address.user_id == user_id).count() == 0
        assert db.query(NotificationEvent).filter(NotificationEvent.user_id == user_id).count() == 0
        assert db.query(PushSubscription).filter(PushSubscription.user_id == user_id).count() == 0

        profile = db.get(DeliveryProfile, user_id)
        assert profile is not None
        assert profile.phone == ""
        assert profile.dni_number == ""
        assert profile.availability == "offline"
        assert profile.is_active is False
        assert profile.current_latitude is None
        assert profile.current_longitude is None
        assert profile.last_location_at is None
        assert profile.push_enabled is False

        application = db.query(DeliveryApplication).filter(DeliveryApplication.user_id == user_id).one()
        assert application.phone == ""
        assert application.dni_number == ""
        assert application.status == "rejected"
        assert application.review_notes == "Cuenta eliminada por solicitud del usuario."

        order = db.get(StoreOrder, order_id)
        assert order is not None
        assert order.assigned_rider_name_snapshot == "Repartidor eliminado"
        assert order.assigned_rider_phone_masked is None
        assert order.assigned_rider_vehicle_type is None
        assert order.tracking_last_latitude is None
        assert order.tracking_last_longitude is None
        assert order.tracking_last_at is None
        assert order.tracking_stale is True

        assignment = db.get(DeliveryAssignment, assignment_id)
        assert assignment is not None
        assert assignment.rider_user_id is None
        assert assignment.current_latitude is None
        assert assignment.current_longitude is None
        assert assignment.current_heading is None
        assert assignment.current_speed_kmh is None
        assert assignment.last_heartbeat_at is None
        assert assignment.tracking_stale is True

        review = db.query(OrderReview).filter(OrderReview.order_id == order_id).one()
        assert review.rider_user_id is None
    finally:
        db.close()


def run_smoke() -> None:
    from fastapi.testclient import TestClient

    from app.main import app

    DB_PATH.unlink(missing_ok=True)

    with TestClient(app) as client:
        customer_headers = _login(client, "cliente@kepedimos.example.com", "cliente123")
        customer_payload = _seed_customer_deletion_data()
        customer_delete = client.delete("/api/v1/auth/me", headers=customer_headers)
        assert customer_delete.status_code == 204, customer_delete.text
        _assert_customer_deleted(customer_payload["user_id"], customer_payload["order_id"])

        delivery_headers = _login(client, "delivery@kepedimos.example.com", "delivery123")
        delivery_payload = _seed_delivery_deletion_data()
        delivery_delete = client.delete("/api/v1/auth/me", headers=delivery_headers)
        assert delivery_delete.status_code == 204, delivery_delete.text
        _assert_delivery_deleted(
            delivery_payload["user_id"],
            delivery_payload["order_id"],
            delivery_payload["assignment_id"],
        )


if __name__ == "__main__":
    configure_environment()
    run_smoke()
    print("smoke_account_deletion_ok")
