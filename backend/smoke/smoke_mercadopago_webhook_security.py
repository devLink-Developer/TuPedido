from __future__ import annotations

import hashlib
import hmac
import os
import sys
import time
from pathlib import Path

DB_PATH = Path(__file__).with_name("smoke_mp_webhook_security.db")
WEBHOOK_SECRET = "SMOKE-WEBHOOK-SECRET"
WEBHOOK_TS = str(int(time.time() * 1000))
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
    os.environ["MERCADOPAGO_WEBHOOK_SECRET"] = WEBHOOK_SECRET
    os.environ["MERCADOPAGO_REDIRECT_URI"] = "http://localhost:8016/api/v1/oauth/mercadopago/callback"
    os.environ["FRONTEND_BASE_URL"] = "http://localhost:8015"
    os.environ["BACKEND_BASE_URL"] = "http://localhost:8016"


def _login(client, email: str, password: str) -> dict[str, str]:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    response.raise_for_status()
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _webhook_headers(payment_id: str = "987654", *, request_id: str = "smoke-security-request") -> dict[str, str]:
    manifest = f"id:{payment_id};request-id:{request_id};ts:{WEBHOOK_TS};"
    signature = hmac.new(WEBHOOK_SECRET.encode(), msg=manifest.encode(), digestmod=hashlib.sha256).hexdigest()
    return {"x-request-id": request_id, "x-signature": f"ts={WEBHOOK_TS},v1={signature}"}


def main() -> None:
    from fastapi.testclient import TestClient

    from app.main import app
    from app.services import mercadopago as mp

    DB_PATH.unlink(missing_ok=True)
    original_request = mp.httpx.request
    captured: dict[str, object] = {}

    def fake_request(method: str, url: str, headers=None, json=None, timeout=None):  # type: ignore[no-untyped-def]
        normalized_method = method.upper()
        if normalized_method == "POST" and url.endswith("/checkout/preferences"):
            return FakeResponse(
                201,
                {
                    "id": "pref_security",
                    "init_point": "https://www.mercadopago.com/checkout/v1/redirect?pref_id=pref_security",
                    "sandbox_init_point": "https://sandbox.mercadopago.com/checkout/v1/redirect?pref_id=pref_security",
                },
            )
        if normalized_method == "GET" and "/v1/payments/" in url:
            order = captured["order"]
            amount = order["total"] if not captured.get("mismatch_amount") else float(order["total"]) + 1
            return FakeResponse(
                200,
                {
                    "id": "987654",
                    "status": "approved",
                    "status_detail": "accredited",
                    "external_reference": captured["reference"],
                    "transaction_amount": amount,
                    "currency_id": "ARS",
                    "collector_id": "123456789",
                    "marketplace_fee": order["service_fee"],
                    "live_mode": False,
                },
            )
        raise AssertionError(f"Unexpected Mercado Pago request: {normalized_method} {url}")

    mp.httpx.request = fake_request
    try:
        with TestClient(app) as client:
            customer_headers = _login(client, "cliente@kepedimos.example.com", "cliente123")
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
                    "payment_method": "mercadopago",
                    "idempotency_key": "smoke-security",
                },
            )
            checkout.raise_for_status()
            captured["reference"] = checkout.json()["payment_reference"]
            order = client.get(f"/api/v1/orders/{checkout.json()['order_id']}", headers=customer_headers)
            order.raise_for_status()
            captured["order"] = order.json()

            simulated = client.post(
                "/api/v1/payments/mercadopago/webhook",
                json={"reference": captured["reference"], "status": "approved"},
            )
            assert simulated.status_code == 403, simulated.text

            invalid_signature = client.post(
                f"/api/v1/payments/mercadopago/webhook?store_id={store['id']}&reference={captured['reference']}&type=payment&data.id=987654",
                json={"type": "payment", "data": {"id": "987654"}},
                headers={"x-request-id": "smoke-security-request", "x-signature": "ts=1,v1=invalid"},
            )
            assert invalid_signature.status_code == 403, invalid_signature.text

            captured["mismatch_amount"] = True
            mismatch = client.post(
                f"/api/v1/payments/mercadopago/webhook?store_id={store['id']}&reference={captured['reference']}&type=payment&data.id=987654",
                json={"type": "payment", "data": {"id": "987654"}},
                headers=_webhook_headers(request_id="smoke-security-mismatch"),
            )
            assert mismatch.status_code == 409, mismatch.text

            captured["mismatch_amount"] = False
            approved = client.post(
                f"/api/v1/payments/mercadopago/webhook?store_id={store['id']}&reference={captured['reference']}&type=payment&data.id=987654",
                json={"type": "payment", "data": {"id": "987654"}},
                headers=_webhook_headers(),
            )
            approved.raise_for_status()
            assert approved.json()["payment_status"] == "approved"

            duplicate = client.post(
                f"/api/v1/payments/mercadopago/webhook?store_id={store['id']}&reference={captured['reference']}&type=payment&data.id=987654",
                json={"type": "payment", "data": {"id": "987654"}},
                headers=_webhook_headers(),
            )
            duplicate.raise_for_status()
            assert duplicate.json()["reason"] == "duplicate_event"
    finally:
        mp.httpx.request = original_request

    print("smoke_mercadopago_webhook_security_ok")


if __name__ == "__main__":
    configure_environment()
    main()
