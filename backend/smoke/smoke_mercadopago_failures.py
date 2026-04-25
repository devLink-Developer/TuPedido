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
    os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
    os.environ["APP_ENV"] = "development"
    os.environ["SEED_DEMO_DATA"] = "true"
    os.environ["MERCADOPAGO_SIMULATED"] = "false"
    os.environ["MERCADOPAGO_CLIENT_ID"] = "SMOKE-CLIENT-ID"
    os.environ["MERCADOPAGO_CLIENT_SECRET"] = "SMOKE-CLIENT-SECRET"
    os.environ["MERCADOPAGO_WEBHOOK_SECRET"] = "SMOKE-WEBHOOK-SECRET"
    os.environ["MERCADOPAGO_REDIRECT_URI"] = "http://localhost:8016/api/v1/oauth/mercadopago/callback"
    os.environ["FRONTEND_BASE_URL"] = "http://localhost:8015"
    os.environ["BACKEND_BASE_URL"] = "http://localhost:8016"


def run_timeout_scenario() -> None:
    from fastapi.testclient import TestClient

    from app.main import app
    from app.services import mercadopago as mp

    DB_PATH.unlink(missing_ok=True)
    original_request = mp.httpx.request

    def fake_request(method: str, url: str, headers=None, json=None, timeout=None):  # type: ignore[no-untyped-def]
        raise httpx.ReadTimeout("Mercado Pago timeout", request=httpx.Request(method.upper(), url))

    mp.httpx.request = fake_request
    try:
        with TestClient(app) as client:
            login = client.post(
                "/api/v1/auth/login",
                json={"email": "cliente@kepedimos.example.com", "password": "cliente123"},
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
        mp.httpx.request = original_request


if __name__ == "__main__":
    configure_environment()
    run_timeout_scenario()
    print("smoke_mercadopago_failures_ok")
