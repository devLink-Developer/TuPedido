from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import urlencode

import httpx
from jose import JWTError, jwt
from sqlalchemy import select

from app.core.config import settings
from app.core.utils import decrypt_sensitive_value, encrypt_sensitive_value
from app.db.session import SessionLocal
from app.models.store import MercadoPagoCredential


class MercadoPagoAPIError(RuntimeError):
    pass


def _build_headers(access_token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }


def _oauth_form_headers() -> dict[str, str]:
    return {
        "accept": "application/json",
        "content-type": "application/x-www-form-urlencoded",
    }


def _now_utc() -> datetime:
    return datetime.now(UTC)


def mercadopago_connection_status(store: object) -> str:
    credentials = getattr(store, "mercadopago_credentials", None)
    if credentials is None:
        return "disconnected"
    if getattr(credentials, "reconnect_required", False):
        return "reconnect_required"
    if (
        getattr(credentials, "is_configured", False)
        and getattr(credentials, "oauth_connected_at", None) is not None
        and getattr(credentials, "refresh_token_encrypted", None)
        and getattr(credentials, "access_token_encrypted", None)
    ):
        return "connected"
    return "disconnected"


def is_store_mercadopago_ready(store: object) -> bool:
    payment_settings = getattr(store, "payment_settings", None)
    credentials = getattr(store, "mercadopago_credentials", None)
    return bool(
        payment_settings
        and payment_settings.mercadopago_enabled
        and credentials
        and credentials.public_key
        and mercadopago_connection_status(store) == "connected"
    )


def get_store_access_token(store: object) -> str:
    credentials = getattr(store, "mercadopago_credentials", None)
    if credentials is None or not credentials.is_configured or not credentials.access_token_encrypted:
        raise MercadoPagoAPIError("Mercado Pago credentials are not configured for this store")
    try:
        return decrypt_sensitive_value(credentials.access_token_encrypted)
    except Exception as exc:  # pragma: no cover - defensive path
        raise MercadoPagoAPIError("Mercado Pago access token could not be decrypted") from exc


def get_store_refresh_token(store: object) -> str:
    credentials = getattr(store, "mercadopago_credentials", None)
    if credentials is None or not credentials.refresh_token_encrypted:
        raise MercadoPagoAPIError("Mercado Pago refresh token is not configured for this store")
    try:
        return decrypt_sensitive_value(credentials.refresh_token_encrypted)
    except Exception as exc:  # pragma: no cover - defensive path
        raise MercadoPagoAPIError("Mercado Pago refresh token could not be decrypted") from exc


def _oauth_token_payload(data: dict[str, Any]) -> dict[str, Any]:
    expires_in = int(data.get("expires_in") or 0)
    expires_at = _now_utc() + timedelta(seconds=expires_in) if expires_in > 0 else None
    return {
        "public_key": data.get("public_key"),
        "access_token": data.get("access_token"),
        "refresh_token": data.get("refresh_token"),
        "collector_id": str(data.get("user_id")) if data.get("user_id") is not None else None,
        "scope": data.get("scope"),
        "live_mode": bool(data.get("live_mode")),
        "token_expires_at": expires_at,
    }


def _persist_reconnect_required(store_id: int) -> None:
    db = SessionLocal()
    try:
        credentials = db.scalar(
            select(MercadoPagoCredential).where(MercadoPagoCredential.store_id == store_id)
        )
        if credentials is None:
            return
        credentials.reconnect_required = True
        credentials.is_configured = False
        db.commit()
    finally:
        db.close()


def store_oauth_credentials(store: object, data: dict[str, Any]) -> None:
    credentials = getattr(store, "mercadopago_credentials", None)
    if credentials is None:
        raise MercadoPagoAPIError("Mercado Pago credentials record is not available for this store")
    payload = _oauth_token_payload(data)
    credentials.public_key = payload["public_key"]
    credentials.access_token_encrypted = encrypt_sensitive_value(str(payload["access_token"] or ""))
    refresh_token = payload["refresh_token"] or get_store_refresh_token(store)
    credentials.refresh_token_encrypted = encrypt_sensitive_value(str(refresh_token))
    credentials.collector_id = payload["collector_id"]
    credentials.scope = payload["scope"]
    credentials.live_mode = bool(payload["live_mode"])
    credentials.token_expires_at = payload["token_expires_at"]
    credentials.oauth_connected_at = credentials.oauth_connected_at or _now_utc()
    credentials.reconnect_required = False
    credentials.is_configured = True


def build_oauth_state(*, store_id: int, user_id: int) -> str:
    payload = {
        "kind": "mercadopago_oauth",
        "store_id": store_id,
        "user_id": user_id,
        "exp": _now_utc() + timedelta(minutes=15),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_oauth_state(state: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(state, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise MercadoPagoAPIError("Mercado Pago OAuth state is invalid") from exc
    if payload.get("kind") != "mercadopago_oauth":
        raise MercadoPagoAPIError("Mercado Pago OAuth state is invalid")
    return payload


def build_oauth_connect_url(*, store_id: int, user_id: int) -> str:
    state = build_oauth_state(store_id=store_id, user_id=user_id)
    if settings.mercadopago_simulated:
        base = settings.backend_base_url.rstrip("/")
        query = urlencode({"code": "SIMULATED-OAUTH", "state": state})
        return f"{base}{settings.api_prefix}/payments/mercadopago/oauth/callback?{query}"
    if not settings.mercadopago_client_id or not settings.mercadopago_redirect_uri:
        raise MercadoPagoAPIError("Mercado Pago OAuth is not configured for this environment")
    query = urlencode(
        {
            "client_id": settings.mercadopago_client_id,
            "response_type": "code",
            "platform_id": "mp",
            "redirect_uri": settings.mercadopago_redirect_uri,
            "state": state,
        }
    )
    return f"{settings.mercadopago_auth_base_url.rstrip('/')}/authorization?{query}"


def exchange_oauth_code(code: str) -> dict[str, Any]:
    if settings.mercadopago_simulated and code == "SIMULATED-OAUTH":
        return {
            "access_token": "SIMULATED-SELLER-ACCESS-TOKEN",
            "public_key": "APP_USR-SIMULATED-1234",
            "refresh_token": "SIMULATED-REFRESH-TOKEN",
            "live_mode": False,
            "user_id": "123456789",
            "token_type": "bearer",
            "expires_in": 15552000,
            "scope": "offline_access payments write",
        }
    if (
        not settings.mercadopago_client_id
        or not settings.mercadopago_client_secret
        or not settings.mercadopago_redirect_uri
    ):
        raise MercadoPagoAPIError("Mercado Pago OAuth is not configured for this environment")
    try:
        response = httpx.post(
            f"{settings.mercadopago_api_base_url.rstrip('/')}/oauth/token",
            headers=_oauth_form_headers(),
            data={
                "client_id": settings.mercadopago_client_id,
                "client_secret": settings.mercadopago_client_secret,
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": settings.mercadopago_redirect_uri,
            },
            timeout=settings.mercadopago_timeout_seconds,
        )
    except httpx.HTTPError as exc:
        raise MercadoPagoAPIError(f"Mercado Pago OAuth exchange failed: {exc}") from exc
    if response.status_code != 200:
        raise MercadoPagoAPIError(
            f"Mercado Pago OAuth exchange failed ({response.status_code}): {response.text}"
        )
    return response.json()


def refresh_store_access_token(store: object) -> str:
    if (
        not settings.mercadopago_client_id
        or not settings.mercadopago_client_secret
        or not settings.mercadopago_redirect_uri
    ):
        raise MercadoPagoAPIError("Mercado Pago OAuth is not configured for this environment")
    store_id = getattr(store, "id")
    refresh_token = get_store_refresh_token(store)
    try:
        response = httpx.post(
            f"{settings.mercadopago_api_base_url.rstrip('/')}/oauth/token",
            headers=_oauth_form_headers(),
            data={
                "client_id": settings.mercadopago_client_id,
                "client_secret": settings.mercadopago_client_secret,
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
                "redirect_uri": settings.mercadopago_redirect_uri,
            },
            timeout=settings.mercadopago_timeout_seconds,
        )
    except httpx.HTTPError as exc:
        _persist_reconnect_required(store_id)
        raise MercadoPagoAPIError(f"Mercado Pago token refresh failed: {exc}") from exc
    if response.status_code != 200:
        _persist_reconnect_required(store_id)
        raise MercadoPagoAPIError(
            f"Mercado Pago token refresh failed ({response.status_code}): {response.text}"
        )
    data = response.json()
    store_oauth_credentials(store, data)
    return get_store_access_token(store)


def ensure_valid_store_access_token(store: object) -> str:
    if mercadopago_connection_status(store) != "connected":
        raise MercadoPagoAPIError("Mercado Pago OAuth connection is not active for this store")
    credentials = getattr(store, "mercadopago_credentials", None)
    if credentials is None:
        raise MercadoPagoAPIError("Mercado Pago credentials are not configured for this store")
    token_expires_at = getattr(credentials, "token_expires_at", None)
    if token_expires_at is None:
        return get_store_access_token(store)
    if token_expires_at <= (_now_utc() + timedelta(minutes=5)):
        return refresh_store_access_token(store)
    return get_store_access_token(store)


def build_notification_url(store_id: int, reference: str) -> str:
    base = settings.backend_base_url.rstrip("/")
    query = urlencode({"store_id": store_id, "reference": reference})
    return f"{base}{settings.api_prefix}/payments/mercadopago/webhook?{query}"


def build_order_return_url(order_id: int) -> str:
    return f"{settings.frontend_base_url.rstrip('/')}/orders/{order_id}"


def create_checkout_preference(
    *,
    store: object,
    payer_email: str,
    order_id: int,
    reference: str,
    items: list[dict[str, Any]],
    marketplace_fee: float,
) -> dict[str, Any]:
    access_token = ensure_valid_store_access_token(store)
    return_url = build_order_return_url(order_id)
    payload = {
        "items": items,
        "marketplace_fee": marketplace_fee,
        "payer": {"email": payer_email},
        "external_reference": reference,
        "notification_url": build_notification_url(getattr(store, "id"), reference),
        "back_urls": {
            "success": return_url,
            "pending": return_url,
            "failure": return_url,
        },
        "auto_return": "approved",
        "metadata": {
            "order_id": order_id,
            "store_id": getattr(store, "id"),
            "platform": "tupedido",
        },
    }
    try:
        response = httpx.post(
            f"{settings.mercadopago_api_base_url.rstrip('/')}/checkout/preferences",
            headers=_build_headers(access_token),
            json=payload,
            timeout=settings.mercadopago_timeout_seconds,
        )
    except httpx.HTTPError as exc:
        raise MercadoPagoAPIError(f"Mercado Pago preference creation failed: {exc}") from exc
    if response.status_code not in {200, 201}:
        raise MercadoPagoAPIError(
            f"Mercado Pago preference creation failed ({response.status_code}): {response.text}"
        )
    data = response.json()
    checkout_url = data.get("init_point") or data.get("sandbox_init_point")
    if not checkout_url:
        raise MercadoPagoAPIError("Mercado Pago preference response did not include a checkout URL")
    return {
        "id": data.get("id"),
        "checkout_url": checkout_url,
        "raw": data,
    }


def fetch_payment(payment_id: str | int, store: object) -> dict[str, Any]:
    access_token = ensure_valid_store_access_token(store)
    try:
        response = httpx.get(
            f"{settings.mercadopago_api_base_url.rstrip('/')}/v1/payments/{payment_id}",
            headers=_build_headers(access_token),
            timeout=settings.mercadopago_timeout_seconds,
        )
    except httpx.HTTPError as exc:
        raise MercadoPagoAPIError(f"Mercado Pago payment fetch failed: {exc}") from exc
    if response.status_code != 200:
        raise MercadoPagoAPIError(
            f"Mercado Pago payment fetch failed ({response.status_code}): {response.text}"
        )
    return response.json()


def normalize_payment_status(status: str | None) -> str:
    normalized = (status or "").strip().lower()
    if normalized == "approved":
        return "approved"
    if normalized in {"pending", "in_process", "authorized", "in_mediation"}:
        return "pending"
    if normalized == "cancelled":
        return "cancelled"
    if normalized in {"rejected", "refunded", "charged_back"}:
        return "rejected"
    return "pending"
