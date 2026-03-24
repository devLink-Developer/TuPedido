from __future__ import annotations

import os
import sys
from pathlib import Path

import httpx

DB_PATH = Path(__file__).with_name("smoke_mp_failures.db")
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


def configure_environment() -> None:
    os.environ.setdefault("DATABASE_URL", f"sqlite:///{DB_PATH.as_posix()}")
    os.environ.setdefault("APP_ENV", "development")
    os.environ.setdefault("SEED_DEMO_DATA", "true")
    os.environ.setdefault("MERCADOPAGO_SIMULATED", "false")
    os.environ.setdefault("FRONTEND_BASE_URL", "http://localhost:8015")
    os.environ.setdefault("BACKEND_BASE_URL", "http://localhost:8016")


def run_timeout_scenario() -> None:
    from fastapi.testclient import TestClient

    from app.main import app
    from app.services import mercadopago as mp

    DB_PATH.unlink(missing_ok=True)
    original_post = mp.httpx.post

    def fake_post(url: str, headers=None, json=None, timeout=None):  # type: ignore[no-untyped-def]
        raise httpx.ReadTimeout("Mercado Pago timeout", request=httpx.Request("POST", url))

    mp.httpx.post = fake_post
    try:
        with TestClient(app) as client:
            login = client.post(
                "/api/v1/auth/login",
                json={"email": "cliente@tupedido.example.com", "password": "cliente123"},
            )
            login.raise_for_status()
            token = login.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}

            store = client.get("/api/v1/catalog/stores").json()[0]
            address_id = client.get("/api/v1/addresses", headers=headers).json()[0]["id"]

            client.post(
                "/api/v1/cart/items",
                headers=headers,
                json={"store_id": store["id"], "product_id": 1, "quantity": 1},
            ).raise_for_status()

            checkout = client.post(
                "/api/v1/checkout",
                headers=headers,
                json={
                    "store_id": store["id"],
                    "address_id": address_id,
                    "delivery_mode": "delivery",
                    "payment_method": "mercadopago",
                },
            )
            assert checkout.status_code == 502, checkout.text

            cart = client.get("/api/v1/cart", headers=headers)
            cart.raise_for_status()
            assert len(cart.json()["items"]) == 1, cart.text

            orders = client.get("/api/v1/orders", headers=headers)
            orders.raise_for_status()
            assert orders.json() == [], orders.text
    finally:
        mp.httpx.post = original_post


if __name__ == "__main__":
    configure_environment()
    run_timeout_scenario()
    print("smoke_mercadopago_failures_ok")
