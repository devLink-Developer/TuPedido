from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from unittest.mock import patch

DB_PATH = Path(__file__).with_name("smoke_mp_oauth_pkce.db")
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
    os.environ["MERCADOPAGO_PUBLIC_KEY"] = "TEST-SMOKE-PUBLIC-KEY"
    os.environ["MERCADOPAGO_WEBHOOK_SECRET"] = "SMOKE-WEBHOOK-SECRET"
    os.environ["MERCADOPAGO_REDIRECT_URI"] = "http://localhost:8016/api/v1/oauth/mercadopago/callback"
    os.environ["FRONTEND_BASE_URL"] = "http://localhost:8015"
    os.environ["BACKEND_BASE_URL"] = "http://localhost:8016"


def _login(client, email: str, password: str) -> dict[str, str]:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    response.raise_for_status()
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def main() -> None:
    from fastapi.testclient import TestClient

    from app.main import app
    from app.services.mercadopago import build_oauth_code_challenge, decode_oauth_session_token, decode_oauth_state

    DB_PATH.unlink(missing_ok=True)

    with TestClient(app) as client:
        merchant_headers = _login(client, "merchant@kepedimos.example.com", "merchant123")

        session = client.post("/api/v1/oauth/mercadopago/session", headers=merchant_headers)
        session.raise_for_status()
        session_response = session.json()
        oauth_session = client.cookies.get("mp_oauth_session")
        assert oauth_session, "OAuth session cookie was not set"
        session_payload = decode_oauth_session_token(oauth_session)
        code_verifier = session_payload.get("code_verifier")
        assert isinstance(code_verifier, str) and 43 <= len(code_verifier) <= 128
        connect_url = session_response["connect_url"]
        parsed_connect_url = urlsplit(connect_url)
        assert parsed_connect_url.path == "/api/v1/oauth/mercadopago/connect"
        assert not parsed_connect_url.query

        connect = client.get("/api/v1/oauth/mercadopago/connect", follow_redirects=False)
        assert connect.status_code == 302, connect.text
        location = connect.headers["location"]
        assert "code_verifier" not in location
        assert "oauth_session_token" not in location

        query = parse_qs(urlsplit(location).query)
        assert query["code_challenge"] == [build_oauth_code_challenge(code_verifier)]
        assert query["code_challenge_method"] == ["S256"]
        assert query["redirect_uri"] == ["http://localhost:8016/api/v1/oauth/mercadopago/callback"]
        state_payload = decode_oauth_state(query["state"][0])
        assert state_payload["code_verifier"] == code_verifier

        client.cookies.clear()
        with patch(
            "app.api.routes.oauth.exchange_oauth_code",
            return_value={
                "access_token": "APP_USR-SMOKE-ACCESS-TOKEN",
                "public_key": "APP_USR-SMOKE-PUBLIC-KEY",
                "refresh_token": "SMOKE-REFRESH-TOKEN",
                "live_mode": False,
                "user_id": "123456789",
                "token_type": "bearer",
                "expires_in": 21600,
                "scope": "offline_access payments write",
            },
        ):
            callback = client.get(
                f"/api/v1/oauth/mercadopago/callback?code=MP-CODE&state={query['state'][0]}",
                follow_redirects=False,
            )
        assert callback.status_code == 302, callback.text
        assert callback.headers["location"].startswith(
            "http://localhost:8015/m/mercadopago?mercadopago_oauth=connected"
        )

    print("smoke_mercadopago_oauth_pkce_ok")


if __name__ == "__main__":
    configure_environment()
    main()
