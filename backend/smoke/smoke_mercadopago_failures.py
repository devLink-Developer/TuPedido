from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

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
    os.environ["MERCADOPAGO_CARD_PAYMENT_ENABLED"] = "true"
    os.environ["MERCADOPAGO_CLIENT_ID"] = "SMOKE-CLIENT-ID"
    os.environ["MERCADOPAGO_CLIENT_SECRET"] = "SMOKE-CLIENT-SECRET"
    os.environ["MERCADOPAGO_PUBLIC_KEY"] = "TEST-SMOKE-PUBLIC-KEY"
    os.environ["MERCADOPAGO_WEBHOOK_SECRET"] = "SMOKE-WEBHOOK-SECRET"
    os.environ["MERCADOPAGO_REDIRECT_URI"] = "http://localhost:8016/api/v1/oauth/mercadopago/callback"
    os.environ["FRONTEND_BASE_URL"] = "http://localhost:8015"
    os.environ["BACKEND_BASE_URL"] = "http://localhost:8016"


def run_timeout_scenario() -> None:
    from fastapi.testclient import TestClient

    from app.main import app
    from app.modules.payments.mercadopago import payment_service

    DB_PATH.unlink(missing_ok=True)
    original_post = payment_service.httpx.post

    def fake_post(url: str, headers=None, json=None, timeout=None):  # type: ignore[no-untyped-def]
        raise httpx.ReadTimeout("Mercado Pago timeout", request=httpx.Request("POST", url))

    payment_service.httpx.post = fake_post
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
            checkout.raise_for_status()
            checkout_payload = checkout.json()
            assert checkout_payload["payment_transaction_id"], checkout.text
            assert checkout_payload["checkout_url"], checkout.text

            query = parse_qs(urlsplit(checkout_payload["checkout_url"]).query)
            session_token = query["session"][0]
            session = client.get(f"/api/v1/payments/mercadopago/session/{session_token}")
            session.raise_for_status()
            session_payload = session.json()

            payment = client.post(
                "/api/v1/payments/mercadopago/card-payment",
                json={
                    "session_token": session_token,
                    "token": "card-token-timeout",
                    "payment_method_id": "visa",
                    "transaction_amount": session_payload["amount"],
                    "installments": 1,
                    "payer": {"email": "cliente@kepedimos.example.com"},
                },
            )
            assert payment.status_code == 502, payment.text

            cart = client.get("/api/v1/cart", headers=headers)
            cart.raise_for_status()
            assert len(cart.json()["items"]) == 0, cart.text

            orders = client.get("/api/v1/orders", headers=headers)
            orders.raise_for_status()
            assert len(orders.json()) == 1, orders.text
            assert orders.json()[0]["payment_status"] == "pending", orders.text

            transaction = client.get(f"/api/v1/orders/{checkout_payload['order_id']}/payment", headers=headers)
            transaction.raise_for_status()
            assert transaction.json()["last_error"], transaction.text
    finally:
        payment_service.httpx.post = original_post


if __name__ == "__main__":
    configure_environment()
    run_timeout_scenario()
    print("smoke_mercadopago_failures_ok")
