from __future__ import annotations

import os
import sys
from pathlib import Path

DB_PATH = Path(__file__).with_name("smoke_service_fee_split_regression.db")
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


def _login(client, email: str, password: str) -> dict[str, str]:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    response.raise_for_status()
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _service_fee_charge_count(order_id: int) -> int:
    from app.db.session import SessionLocal
    from app.models.platform import MerchantServiceFeeCharge

    db = SessionLocal()
    try:
        return db.query(MerchantServiceFeeCharge).filter(MerchantServiceFeeCharge.order_id == order_id).count()
    finally:
        db.close()


def _create_pickup_order(client, *, customer_headers: dict[str, str], payment_method: str) -> dict[str, object]:
    store = client.get("/api/v1/catalog/stores").json()[0]
    client.post(
        "/api/v1/cart/items",
        headers=customer_headers,
        json={"store_id": store["id"], "product_id": 1, "quantity": 1},
    ).raise_for_status()
    checkout = client.post(
        "/api/v1/checkout",
        headers=customer_headers,
        json={
            "store_id": store["id"],
            "address_id": None,
            "delivery_mode": "pickup",
            "payment_method": payment_method,
        },
    )
    checkout.raise_for_status()
    return checkout.json()


def _move_pickup_order_to_delivered(client, *, merchant_headers: dict[str, str], order_id: int) -> None:
    for status_value in ("preparing", "ready_for_pickup", "delivered"):
        response = client.put(
            f"/api/v1/merchant/orders/{order_id}/status",
            headers=merchant_headers,
            json={"status": status_value},
        )
        response.raise_for_status()


def _approve_mercadopago_order(client, *, store_id: int, reference: str) -> None:
    webhook = client.post(
        f"/api/v1/payments/mercadopago/webhook?store_id={store_id}&reference={reference}&type=payment&data.id=987654",
        json={"type": "payment", "data": {"id": "987654"}},
    )
    webhook.raise_for_status()


def main() -> None:
    from fastapi.testclient import TestClient

    from app.main import app
    from app.services import mercadopago as mp

    DB_PATH.unlink(missing_ok=True)
    original_request = mp.httpx.request
    captured_reference: dict[str, str] = {}

    def fake_request(method: str, url: str, headers=None, json=None, timeout=None):  # type: ignore[no-untyped-def]
        normalized_method = method.upper()
        if normalized_method == "POST" and url.endswith("/checkout/preferences"):
            return FakeResponse(
                201,
                {
                    "id": "pref_service_fee",
                    "init_point": "https://www.mercadopago.com/checkout/v1/redirect?pref_id=pref_service_fee",
                    "sandbox_init_point": "https://sandbox.mercadopago.com/checkout/v1/redirect?pref_id=pref_service_fee",
                },
            )
        if normalized_method == "GET" and "/v1/payments/" in url:
            return FakeResponse(
                200,
                {
                    "id": "987654",
                    "status": "approved",
                    "external_reference": captured_reference["value"],
                },
            )
        raise AssertionError(f"Unexpected Mercado Pago request: {normalized_method} {url}")

    mp.httpx.request = fake_request
    try:
        with TestClient(app) as client:
            customer_headers = _login(client, "cliente@kepedimos.example.com", "cliente123")
            merchant_headers = _login(client, "merchant@kepedimos.example.com", "merchant123")

            cash_checkout = _create_pickup_order(client, customer_headers=customer_headers, payment_method="cash")
            _move_pickup_order_to_delivered(client, merchant_headers=merchant_headers, order_id=cash_checkout["order_id"])
            assert _service_fee_charge_count(cash_checkout["order_id"]) == 1

            mercadopago_checkout = _create_pickup_order(
                client,
                customer_headers=customer_headers,
                payment_method="mercadopago",
            )
            captured_reference["value"] = str(mercadopago_checkout["payment_reference"])
            store = client.get("/api/v1/catalog/stores").json()[0]
            _approve_mercadopago_order(
                client,
                store_id=store["id"],
                reference=str(mercadopago_checkout["payment_reference"]),
            )
            _move_pickup_order_to_delivered(
                client,
                merchant_headers=merchant_headers,
                order_id=mercadopago_checkout["order_id"],
            )
            assert _service_fee_charge_count(mercadopago_checkout["order_id"]) == 0
    finally:
        mp.httpx.request = original_request

    print("smoke_service_fee_split_regression_ok")


if __name__ == "__main__":
    configure_environment()
    main()
