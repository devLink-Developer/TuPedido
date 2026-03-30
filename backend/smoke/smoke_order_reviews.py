from __future__ import annotations

import os
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

DB_PATH = Path(__file__).with_name("smoke_order_reviews.db")
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


def configure_environment() -> None:
    os.environ.setdefault("DATABASE_URL", f"sqlite:///{DB_PATH.as_posix()}")
    os.environ.setdefault("APP_ENV", "development")
    os.environ.setdefault("SEED_DEMO_DATA", "true")
    os.environ.setdefault("FRONTEND_BASE_URL", "http://localhost:8015")
    os.environ.setdefault("BACKEND_BASE_URL", "http://localhost:8016")


def _seed_reviewable_orders() -> tuple[int, int]:
    from app.db.session import SessionLocal
    from app.models.order import StoreOrder
    from app.models.store import Store
    from app.models.user import Address, User

    now = datetime.now(UTC)
    db = SessionLocal()
    try:
        customer = db.query(User).filter(User.email == "cliente@tupedido.example.com").one()
        rider = db.query(User).filter(User.email == "delivery@tupedido.example.com").one()
        store = db.query(Store).filter(Store.slug == "comercio-demo").one()
        address = db.query(Address).filter(Address.user_id == customer.id).first()
        if address is None:
            raise AssertionError("Expected seeded customer address")

        first_order = StoreOrder(
            user_id=customer.id,
            store_id=store.id,
            address_id=address.id,
            delivery_mode="pickup",
            payment_method="cash",
            payment_status="approved",
            customer_name_snapshot=customer.full_name,
            store_name_snapshot=store.name,
            store_slug_snapshot=store.slug,
            store_address_snapshot=store.address,
            address_label_snapshot=address.label,
            address_full_snapshot=f"{address.street} {address.details}",
            subtotal=1000,
            commercial_discount_total=0,
            financial_discount_total=0,
            delivery_fee=0,
            service_fee=0,
            delivery_fee_customer=0,
            rider_fee=0,
            total=1000,
            status="delivered",
            delivery_status="delivered",
            delivery_provider="pickup",
            otp_required=False,
            delivered_at=now - timedelta(hours=2),
            review_prompt_enabled=True,
        )
        db.add(first_order)
        db.flush()

        second_order = StoreOrder(
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
            subtotal=1500,
            commercial_discount_total=0,
            financial_discount_total=0,
            delivery_fee=200,
            service_fee=0,
            delivery_fee_customer=200,
            rider_fee=150,
            total=1700,
            status="delivered",
            delivery_status="delivered",
            delivery_provider="platform",
            assigned_rider_id=rider.id,
            assigned_rider_name_snapshot=rider.full_name,
            assigned_rider_phone_masked="***1234",
            assigned_rider_vehicle_type="motorcycle",
            otp_required=False,
            delivered_at=now - timedelta(hours=1),
            review_prompt_enabled=True,
        )
        db.add(second_order)
        db.flush()

        historical_order = StoreOrder(
            user_id=customer.id,
            store_id=store.id,
            address_id=address.id,
            delivery_mode="pickup",
            payment_method="cash",
            payment_status="approved",
            customer_name_snapshot=customer.full_name,
            store_name_snapshot=store.name,
            store_slug_snapshot=store.slug,
            store_address_snapshot=store.address,
            address_label_snapshot=address.label,
            address_full_snapshot=f"{address.street} {address.details}",
            subtotal=900,
            commercial_discount_total=0,
            financial_discount_total=0,
            delivery_fee=0,
            service_fee=0,
            delivery_fee_customer=0,
            rider_fee=0,
            total=900,
            status="delivered",
            delivery_status="delivered",
            delivery_provider="pickup",
            otp_required=False,
            delivered_at=now - timedelta(days=1),
            review_prompt_enabled=False,
        )
        db.add(historical_order)
        db.commit()
        return first_order.id, second_order.id
    finally:
        db.close()


def run_smoke() -> None:
    from fastapi.testclient import TestClient

    from app.db.session import SessionLocal
    from app.main import app
    from app.models.delivery import DeliveryProfile
    from app.models.order import OrderReview
    from app.models.store import Store

    DB_PATH.unlink(missing_ok=True)

    with TestClient(app) as client:
        login = client.post(
            "/api/v1/auth/login",
            json={"email": "cliente@tupedido.example.com", "password": "cliente123"},
        )
        login.raise_for_status()
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        first_order_id, second_order_id = _seed_reviewable_orders()

        pending = client.get("/api/v1/orders/pending-review", headers=headers)
        pending.raise_for_status()
        payload = pending.json()
        assert payload["order_id"] == first_order_id, payload
        assert payload["requires_rider_rating"] is False, payload

        submit_first = client.post(
            f"/api/v1/orders/{first_order_id}/review",
            headers=headers,
            json={"store_rating": 5, "review_text": "Muy buen retiro."},
        )
        assert submit_first.status_code == 204, submit_first.text

        pending = client.get("/api/v1/orders/pending-review", headers=headers)
        pending.raise_for_status()
        payload = pending.json()
        assert payload["order_id"] == second_order_id, payload
        assert payload["requires_rider_rating"] is True, payload

        missing_rider = client.post(
            f"/api/v1/orders/{second_order_id}/review",
            headers=headers,
            json={"store_rating": 4},
        )
        assert missing_rider.status_code == 400, missing_rider.text

        submit_second = client.post(
            f"/api/v1/orders/{second_order_id}/review",
            headers=headers,
            json={"store_rating": 4, "rider_rating": 5, "review_text": "Entrega prolija."},
        )
        assert submit_second.status_code == 204, submit_second.text

        pending = client.get("/api/v1/orders/pending-review", headers=headers)
        pending.raise_for_status()
        assert pending.json() is None, pending.text

        db = SessionLocal()
        try:
            reviews = db.query(OrderReview).order_by(OrderReview.order_id.asc()).all()
            assert len(reviews) == 2
            assert reviews[0].review_text == "Muy buen retiro."
            assert reviews[1].review_text == "Entrega prolija."

            store = db.query(Store).filter(Store.slug == "comercio-demo").one()
            rider_profile = db.query(DeliveryProfile).filter(DeliveryProfile.user_id == reviews[1].rider_user_id).one()
            assert store.rating_count == 2
            assert float(store.rating) == 4.5
            assert float(rider_profile.rating) == 5.0
        finally:
            db.close()


if __name__ == "__main__":
    configure_environment()
    run_smoke()
    print("smoke_order_reviews_ok")
