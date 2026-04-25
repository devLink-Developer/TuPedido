from __future__ import annotations

import os
import sys
from pathlib import Path

DB_PATH = Path(__file__).with_name("smoke_mp_disconnect.db")
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


def main() -> None:
    from fastapi.testclient import TestClient

    from app.main import app

    DB_PATH.unlink(missing_ok=True)

    with TestClient(app) as client:
        login = client.post(
            "/api/v1/auth/login",
            json={"email": "merchant@kepedimos.example.com", "password": "merchant123"},
        )
        login.raise_for_status()
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        store = client.get("/api/v1/merchant/store", headers=headers)
        store.raise_for_status()
        store_payload = store.json()
        assert store_payload["payment_settings"]["mercadopago_connection_status"] == "connected"
        assert store_payload["payment_settings"]["mercadopago_enabled"] is True
        assert store_payload["payment_settings"]["mercadopago_mp_user_id"] == "123456789"

        disconnect = client.post("/api/v1/oauth/mercadopago/disconnect", headers=headers)
        disconnect.raise_for_status()
        assert disconnect.json()["status"] == "disconnected"

        refreshed_store = client.get("/api/v1/merchant/store", headers=headers)
        refreshed_store.raise_for_status()
        refreshed_payload = refreshed_store.json()
        assert refreshed_payload["payment_settings"]["mercadopago_connection_status"] == "disconnected"
        assert refreshed_payload["payment_settings"]["mercadopago_enabled"] is False
        assert refreshed_payload["payment_settings"]["mercadopago_mp_user_id"] is None

    print("smoke_mercadopago_disconnect_ok")


if __name__ == "__main__":
    configure_environment()
    main()
