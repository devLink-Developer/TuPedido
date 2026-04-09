from __future__ import annotations

import os
import sys
from pathlib import Path

DB_PATH = Path(__file__).with_name("smoke_startup_seed_restart.db")
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

CANONICAL_ADMIN_EMAIL = "admin@kepedimos.com"
DEMO_ADMIN_LEGACY_EMAILS = (
    "admin@kepedimos.example.com",
    "admin@tupedido.example.com",
    "admin@tupedido.local",
)


def configure_environment() -> None:
    os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
    os.environ["APP_ENV"] = "development"
    os.environ["SEED_DEMO_DATA"] = "true"
    os.environ["FRONTEND_BASE_URL"] = "http://localhost:8015"
    os.environ["BACKEND_BASE_URL"] = "http://localhost:8016"
    os.environ["DELIVERY_EMBEDDED_WORKER"] = "false"
    os.environ["BOOTSTRAP_ADMIN_EMAIL"] = CANONICAL_ADMIN_EMAIL
    os.environ["BOOTSTRAP_ADMIN_PASSWORD"] = "admin1234"
    os.environ["BOOTSTRAP_ADMIN_FULL_NAME"] = "Admin Kepedimos"
    os.environ["MERCADOPAGO_SIMULATED"] = "true"


def prepare_database() -> dict[str, int]:
    import app.models  # noqa: F401
    from app.core.security import hash_password
    from app.db.base import Base
    from app.db.session import SessionLocal, engine
    from app.models.user import User

    DB_PATH.unlink(missing_ok=True)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        legacy_admin_ids: dict[str, int] = {}
        for index, email in enumerate(DEMO_ADMIN_LEGACY_EMAILS, start=1):
            user = User(
                full_name=f"Legacy Demo Admin {index}",
                email=email,
                hashed_password=hash_password("legacy-admin"),
                role="admin",
                is_active=True,
                must_change_password=False,
            )
            db.add(user)
            db.flush()
            legacy_admin_ids[email] = user.id
        db.commit()
        return legacy_admin_ids
    finally:
        db.close()


def load_app():
    import app.main as app_main

    app_main.run_schema_migrations = lambda: None
    return app_main.app


def login_admin(client) -> dict[str, object]:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": CANONICAL_ADMIN_EMAIL, "password": "admin1234"},
    )
    response.raise_for_status()
    return response.json()


def assert_demo_admin_state(expected_canonical_id: int) -> None:
    from app.db.session import SessionLocal
    from app.models.user import User

    demo_admin_emails = (CANONICAL_ADMIN_EMAIL, *DEMO_ADMIN_LEGACY_EMAILS)
    db = SessionLocal()
    try:
        demo_admins = db.query(User).filter(User.email.in_(demo_admin_emails)).order_by(User.id.asc()).all()
        active_demo_admins = [user for user in demo_admins if user.is_active]
        assert len(active_demo_admins) == 1, [(user.email, user.is_active) for user in demo_admins]
        assert active_demo_admins[0].email == CANONICAL_ADMIN_EMAIL
        assert active_demo_admins[0].id == expected_canonical_id
        assert active_demo_admins[0].role == "admin"
    finally:
        db.close()


def mutate_seeded_data() -> None:
    from app.db.session import SessionLocal
    from app.models.delivery import DeliveryZone, DeliveryZoneRate
    from app.models.store import Product, Store, StoreHour
    from app.models.user import Address, User

    db = SessionLocal()
    try:
        customer = db.query(User).filter(User.email == "cliente@kepedimos.example.com").one()
        merchant = db.query(User).filter(User.email == "merchant@kepedimos.example.com").one()
        store = db.query(Store).filter(Store.owner_user_id == merchant.id).one()
        zone = db.query(DeliveryZone).filter(DeliveryZone.name == "CABA Norte").one()

        merchant.full_name = "Comercio Demo Personalizado"
        store.name = "Almacen Belgrano Personalizado"

        combo_product = db.query(Product).filter(Product.store_id == store.id, Product.name == "Combo Ahorro").one()
        missing_hour = db.query(StoreHour).filter(StoreHour.store_id == store.id, StoreHour.day_of_week == 3).one()
        car_rate = (
            db.query(DeliveryZoneRate)
            .filter(DeliveryZoneRate.zone_id == zone.id, DeliveryZoneRate.vehicle_type == "car")
            .one()
        )

        db.delete(combo_product)
        db.delete(missing_hour)
        db.delete(car_rate)
        for address in db.query(Address).filter(Address.user_id == customer.id).all():
            db.delete(address)

        db.commit()
    finally:
        db.close()


def assert_second_startup_state(expected_canonical_id: int) -> None:
    from app.db.session import SessionLocal
    from app.models.delivery import DeliveryZone, DeliveryZoneRate
    from app.models.store import Product, Store, StoreHour
    from app.models.user import Address, User

    db = SessionLocal()
    try:
        customer = db.query(User).filter(User.email == "cliente@kepedimos.example.com").one()
        merchant = db.query(User).filter(User.email == "merchant@kepedimos.example.com").one()
        store = db.query(Store).filter(Store.owner_user_id == merchant.id).one()
        zone = db.query(DeliveryZone).filter(DeliveryZone.name == "CABA Norte").one()

        assert merchant.full_name == "Comercio Demo Personalizado"
        assert store.name == "Almacen Belgrano Personalizado"

        customer_addresses = db.query(Address).filter(Address.user_id == customer.id).all()
        assert len(customer_addresses) == 1

        combo_product = db.query(Product).filter(Product.store_id == store.id, Product.name == "Combo Ahorro").one()
        assert combo_product.is_available is True

        store_hours = db.query(StoreHour).filter(StoreHour.store_id == store.id).all()
        assert len(store_hours) == 7
        assert {hour.day_of_week for hour in store_hours} == set(range(7))

        car_rate = (
            db.query(DeliveryZoneRate)
            .filter(DeliveryZoneRate.zone_id == zone.id, DeliveryZoneRate.vehicle_type == "car")
            .one()
        )
        assert float(car_rate.delivery_fee_customer) == 4.8
        assert float(car_rate.rider_fee) == 3.1
    finally:
        db.close()

    assert_demo_admin_state(expected_canonical_id)


def run_smoke() -> None:
    from fastapi.testclient import TestClient

    legacy_admin_ids = prepare_database()
    app = load_app()
    expected_canonical_id = legacy_admin_ids["admin@kepedimos.example.com"]

    with TestClient(app) as client:
        first_login = login_admin(client)
        assert first_login["user"]["email"] == CANONICAL_ADMIN_EMAIL
        assert first_login["user"]["id"] == expected_canonical_id
        assert_demo_admin_state(expected_canonical_id)

    mutate_seeded_data()

    with TestClient(app) as client:
        second_login = login_admin(client)
        assert second_login["user"]["email"] == CANONICAL_ADMIN_EMAIL
        assert second_login["user"]["id"] == expected_canonical_id

    assert_second_startup_state(expected_canonical_id)


if __name__ == "__main__":
    configure_environment()
    run_smoke()
    print("smoke_startup_seed_restart_ok")
