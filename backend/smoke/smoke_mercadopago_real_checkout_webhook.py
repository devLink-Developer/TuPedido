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
    os.environ.setdefault("DATABASE_URL", f"sqlite:///{DB_PATH.as_posix()}")
    os.environ.setdefault("APP_ENV", "development")
    os.environ.setdefault("SEED_DEMO_DATA", "true")
    os.environ.setdefault("MERCADOPAGO_SIMULATED", "false")
    os.environ.setdefault("FRONTEND_BASE_URL", "http://localhost:8015")
    os.environ.setdefault("BACKEND_BASE_URL", "http://localhost:8016")


def main() -> None:
    from fastapi.testclient import TestClient

    from app.main import app
    from app.services import mercadopago as mp

    DB_PATH.unlink(missing_ok=True)

    captured: dict[str, object] = {}
    original_post = mp.httpx.post
    original_get = mp.httpx.get

    def fake_post(url: str, headers=None, json=None, timeout=None):  # type: ignore[no-untyped-def]
        captured["preference_payload"] = json
        return FakeResponse(
            201,
            {
                "id": "pref_123",
                "init_point": "https://www.mercadopago.com/checkout/v1/redirect?pref_id=pref_123",
            },
        )

    def fake_get(url: str, headers=None, timeout=None):  # type: ignore[no-untyped-def]
        return FakeResponse(
            200,
            {
                "id": "987654",
                "status": "approved",
                "external_reference": captured["reference"],
            },
        )

    mp.httpx.post = fake_post
    mp.httpx.get = fake_get

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

            assert checkout_payload["checkout_url"].startswith("https://www.mercadopago.com/checkout/")
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
        mp.httpx.post = original_post
        mp.httpx.get = original_get


if __name__ == "__main__":
    configure_environment()
    main()
