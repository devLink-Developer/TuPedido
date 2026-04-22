from __future__ import annotations

import os
import sys
from pathlib import Path

DB_PATH = Path(__file__).with_name("smoke_mp_provider_guardrails.db")
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
    os.environ["MERCADOPAGO_REDIRECT_URI"] = "http://localhost:8016/api/v1/oauth/mercadopago/callback"
    os.environ["FRONTEND_BASE_URL"] = "http://localhost:8015"
    os.environ["BACKEND_BASE_URL"] = "http://localhost:8016"


def _login(client, email: str, password: str) -> dict[str, str]:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    response.raise_for_status()
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _tamper_provider(*, redirect_uri: str | None) -> None:
    from app.db.session import SessionLocal
    from app.models.platform import PaymentProvider

    db = SessionLocal()
    try:
        provider = db.query(PaymentProvider).filter(PaymentProvider.provider == "mercadopago").one()
        provider.enabled = True
        provider.redirect_uri = redirect_uri
        db.commit()
    finally:
        db.close()


def main() -> None:
    from fastapi.testclient import TestClient

    from app.main import app

    DB_PATH.unlink(missing_ok=True)

    with TestClient(app) as client:
        admin_headers = _login(client, "admin@kepedimos.com", "admin1234")
        merchant_headers = _login(client, "merchant@kepedimos.example.com", "merchant123")
        customer_headers = _login(client, "cliente@kepedimos.example.com", "cliente123")

        provider = client.get("/api/v1/admin/payment-providers/mercadopago", headers=admin_headers)
        provider.raise_for_status()
        provider_payload = provider.json()

        disable_provider = client.post(
            "/api/v1/admin/payment-providers/mercadopago",
            headers=admin_headers,
            json={
                "client_id": provider_payload["client_id"],
                "redirect_uri": provider_payload["redirect_uri"],
                "enabled": False,
                "mode": provider_payload["mode"],
            },
        )
        disable_provider.raise_for_status()

        merchant_connect_url = client.get("/api/v1/merchant/payments/mercadopago/connect-url", headers=merchant_headers)
        assert merchant_connect_url.status_code == 409, merchant_connect_url.text
        merchant_session = client.post("/api/v1/oauth/mercadopago/session", headers=merchant_headers)
        assert merchant_session.status_code == 409, merchant_session.text
        enable_payment_method = client.put(
            "/api/v1/merchant/store/payment-settings",
            headers=merchant_headers,
            json={"cash_enabled": True, "mercadopago_enabled": True},
        )
        assert enable_payment_method.status_code == 409, enable_payment_method.text

        restore_provider = client.post(
            "/api/v1/admin/payment-providers/mercadopago",
            headers=admin_headers,
            json={
                "client_id": provider_payload["client_id"],
                "redirect_uri": provider_payload["redirect_uri"],
                "enabled": True,
                "mode": provider_payload["mode"],
            },
        )
        restore_provider.raise_for_status()

        _tamper_provider(redirect_uri=None)
        incomplete_connect_url = client.get("/api/v1/merchant/payments/mercadopago/connect-url", headers=merchant_headers)
        assert incomplete_connect_url.status_code == 409, incomplete_connect_url.text
        incomplete_session = client.post("/api/v1/oauth/mercadopago/session", headers=merchant_headers)
        assert incomplete_session.status_code == 409, incomplete_session.text

        _tamper_provider(redirect_uri=provider_payload["redirect_uri"])

        reconnect_bootstrap = client.get("/api/v1/merchant/payments/mercadopago/connect-url", headers=merchant_headers)
        reconnect_bootstrap.raise_for_status()

        disconnect = client.post("/api/v1/oauth/mercadopago/disconnect", headers=merchant_headers)
        disconnect.raise_for_status()

        reconnect_settings = client.put(
            "/api/v1/merchant/store/payment-settings",
            headers=merchant_headers,
            json={"cash_enabled": True, "mercadopago_enabled": True},
        )
        assert reconnect_settings.status_code == 409, reconnect_settings.text

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
            },
        )
        assert checkout.status_code == 409, checkout.text

    print("smoke_mercadopago_provider_guardrails_ok")


if __name__ == "__main__":
    configure_environment()
    main()
