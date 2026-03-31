from __future__ import annotations

import os
import sys
from pathlib import Path

DB_PATH = Path(__file__).with_name("smoke_mp_real_checkout_webhook.db")
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


class FakeResponse:
    def __init__(self, status_code: int, payload: dict[str, object]) -> None:
        self.status_code = status_code
        self._payload = payload
        self.text = str(payload)

    def json(self) -> dict[str, object]:
        return self._payload


def configure_environment() -> None:
    os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
    os.environ["APP_ENV"] = "development"
    os.environ["SEED_DEMO_DATA"] = "true"
    os.environ["MERCADOPAGO_SIMULATED"] = "false"
    os.environ["MERCADOPAGO_CLIENT_ID"] = "SMOKE-CLIENT-ID"
    os.environ["MERCADOPAGO_CLIENT_SECRET"] = "SMOKE-CLIENT-SECRET"
    os.environ["MERCADOPAGO_REDIRECT_URI"] = "http://localhost:8016/api/v1/oauth/mercadopago/callback"
    os.environ["FRONTEND_BASE_URL"] = "http://localhost:8015"
    os.environ["BACKEND_BASE_URL"] = "http://localhost:8016"


def main() -> None:
    from fastapi.testclient import TestClient

    from app.main import app
    from app.services import mercadopago as mp

    DB_PATH.unlink(missing_ok=True)

    captured: dict[str, object] = {}
    original_request = mp.httpx.request

    def fake_request(method: str, url: str, headers=None, json=None, timeout=None):  # type: ignore[no-untyped-def]
        normalized_method = method.upper()
        if normalized_method == "POST" and url.endswith("/checkout/preferences"):
            captured["preference_payload"] = json
            return FakeResponse(
                201,
                {
                    "id": "pref_123",
                    "init_point": "https://www.mercadopago.com/checkout/v1/redirect?pref_id=pref_123",
                    "sandbox_init_point": "https://sandbox.mercadopago.com/checkout/v1/redirect?pref_id=pref_123",
                },
            )
        if normalized_method == "GET" and "/v1/payments/" in url:
            return FakeResponse(
                200,
                {
                    "id": "987654",
                    "status": "approved",
                    "external_reference": captured["reference"],
                },
            )
        raise AssertionError(f"Unexpected Mercado Pago request: {normalized_method} {url}")

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
                json={"store_id": store["id"], "product_id": 1, "quantity": 2},
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
            captured["reference"] = checkout_payload["payment_reference"]

            assert checkout_payload["checkout_url"] is not None
            assert any(item["title"] == "Envio" for item in captured["preference_payload"]["items"])

            webhook = client.post(
                f"/api/v1/payments/mercadopago/webhook?store_id={store['id']}&reference={captured['reference']}&type=payment&data.id=987654",
                json={"type": "payment", "data": {"id": "987654"}},
            )
            webhook.raise_for_status()
            assert webhook.json()["payment_status"] == "approved"

            order = client.get(f"/api/v1/orders/{checkout_payload['order_id']}", headers=headers)
            order.raise_for_status()
            assert order.json()["payment_status"] == "approved"

        print("smoke_mercadopago_real_checkout_webhook_ok")
    finally:
        mp.httpx.request = original_request


if __name__ == "__main__":
    configure_environment()
    main()
