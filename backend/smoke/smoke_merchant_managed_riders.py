from __future__ import annotations

import os
import sys
from pathlib import Path

DB_PATH = Path(__file__).with_name("smoke_merchant_managed_riders.db")
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


def configure_environment() -> None:
    os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
    os.environ["APP_ENV"] = "development"
    os.environ["SEED_DEMO_DATA"] = "true"
    os.environ["FRONTEND_BASE_URL"] = "http://localhost:8015"
    os.environ["BACKEND_BASE_URL"] = "http://localhost:8016"
    os.environ["BOOTSTRAP_ADMIN_ENABLED"] = "true"
    os.environ["BOOTSTRAP_ADMIN_FULL_NAME"] = "Admin Kepedimos"
    os.environ["BOOTSTRAP_ADMIN_EMAIL"] = "admin@kepedimos.com"
    os.environ["BOOTSTRAP_ADMIN_PASSWORD"] = "admin1234"


def _login(client, email: str, password: str) -> dict[str, str]:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    response.raise_for_status()
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def main() -> None:
    from fastapi.testclient import TestClient

    from app.main import app

    DB_PATH.unlink(missing_ok=True)

    with TestClient(app) as client:
        admin_headers = _login(
            client,
            os.environ["BOOTSTRAP_ADMIN_EMAIL"],
            os.environ["BOOTSTRAP_ADMIN_PASSWORD"],
        )
        merchant_headers = _login(client, "merchant@kepedimos.example.com", "merchant123")

        payload = {
            "full_name": "Rider Comercio",
            "email": "rider.comercio@example.com",
            "password": "rider123",
            "phone": "1122334455",
            "vehicle_type": "motorcycle",
            "dni_number": "30111222",
            "emergency_contact_name": "Contacto Rider",
            "emergency_contact_phone": "1199988877",
            "license_number": "LIC-123",
            "vehicle_plate": "AA123BB",
            "insurance_policy": "POL-998",
            "notes": "Alta desde smoke"
        }

        admin_create = client.post("/api/v1/admin/delivery/riders", headers=admin_headers, json=payload)
        assert admin_create.status_code == 410, admin_create.text
        assert "Cada comercio gestiona" in admin_create.json()["detail"], admin_create.text

        merchant_create = client.post("/api/v1/merchant/riders", headers=merchant_headers, json=payload)
        assert merchant_create.status_code == 201, merchant_create.text
        merchant_rider = merchant_create.json()
        assert merchant_rider["store_id"] is not None, merchant_rider
        assert merchant_rider["store_name"], merchant_rider
        assert merchant_rider["email"] == payload["email"], merchant_rider

        merchant_list = client.get("/api/v1/merchant/riders", headers=merchant_headers)
        merchant_list.raise_for_status()
        riders = merchant_list.json()
        assert any(rider["email"] == payload["email"] for rider in riders), riders

    print("smoke_merchant_managed_riders_ok")


if __name__ == "__main__":
    configure_environment()
    main()
