from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import urlencode, urlsplit

import httpx
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.orm import Session, object_session

from app.core.config import settings
from app.core.utils import decrypt_sensitive_value, encrypt_sensitive_value
from app.db.session import SessionLocal
from app.models.platform import PaymentProvider
from app.models.store import MerchantPaymentAccount

logger = logging.getLogger(__name__)

MERCADOPAGO_PROVIDER = "mercadopago"
SIMULATED_WEBHOOK_SECRET = "SIMULATED-WEBHOOK-SECRET"
OAUTH_STATE_EXPIRATION_MINUTES = 15
OAUTH_SESSION_EXPIRATION_MINUTES = 10


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


def _ensure_utc_datetime(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _normalize_provider_mode(value: str | None) -> str:
    return "production" if (value or "").strip().lower() == "production" else "sandbox"


def normalize_frontend_origin(value: str | None) -> str:
    fallback = settings.frontend_base_url.rstrip("/")
    if not value:
        return fallback
    try:
        parsed = urlsplit(value)
    except ValueError:
        return fallback
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return fallback
    return f"{parsed.scheme}://{parsed.netloc}"


def _normalize_http_base_url(value: str | None) -> str | None:
    if not value:
        return None
    try:
        parsed = urlsplit(value.strip())
    except ValueError:
        return None
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    return f"{parsed.scheme}://{parsed.netloc}".rstrip("/")


def _is_internal_hostname(hostname: str | None) -> bool:
    if not hostname:
        return True
    normalized = hostname.rstrip(".").lower()
    if normalized in {"localhost", "127.0.0.1", "0.0.0.0", "::1", "backend", "frontend", "db", "redis", "worker"}:
        return True
    return "." not in normalized


def is_internal_http_url(value: str | None) -> bool:
    normalized_url = _normalize_http_base_url(value)
    if not normalized_url:
        return True
    return _is_internal_hostname(urlsplit(normalized_url).hostname)


def resolve_public_backend_base_url(base_url: str | None = None) -> str:
    configured_base_url = _normalize_http_base_url(settings.backend_base_url)
    if configured_base_url and not _is_internal_hostname(urlsplit(configured_base_url).hostname):
        return configured_base_url

    request_base_url = _normalize_http_base_url(base_url)
    if request_base_url and not _is_internal_hostname(urlsplit(request_base_url).hostname):
        return request_base_url

    return configured_base_url or request_base_url or settings.backend_base_url.rstrip("/")


def _provider_enabled_from_settings() -> bool:
    if not (
        settings.mercadopago_client_id
        and settings.mercadopago_client_secret
        and settings.mercadopago_redirect_uri
    ):
        return False
    if not settings.mercadopago_simulated and not settings.mercadopago_webhook_secret:
        return False
    return bool(
        settings.mercadopago_client_id
        and settings.mercadopago_client_secret
        and settings.mercadopago_redirect_uri
    )


def get_or_create_mercadopago_provider(db: Session) -> PaymentProvider:
    provider = db.scalar(
        select(PaymentProvider).where(PaymentProvider.provider == MERCADOPAGO_PROVIDER)
    )
    if provider is not None:
        return provider

    provider = PaymentProvider(
        provider=MERCADOPAGO_PROVIDER,
        client_id=settings.mercadopago_client_id,
        client_secret_encrypted=encrypt_sensitive_value(settings.mercadopago_client_secret)
        if settings.mercadopago_client_secret
        else None,
        webhook_secret_encrypted=encrypt_sensitive_value(settings.mercadopago_webhook_secret)
        if settings.mercadopago_webhook_secret
        else None,
        redirect_uri=settings.mercadopago_redirect_uri,
        enabled=_provider_enabled_from_settings(),
        mode="sandbox",
    )
    db.add(provider)
    db.flush()
    return provider


def is_provider_operable(provider: PaymentProvider | None) -> bool:
    return bool(
        provider
        and provider.enabled
        and provider.client_id
        and provider.client_secret_encrypted
        and (settings.mercadopago_simulated or provider_webhook_secret_configured(provider))
        and provider.redirect_uri
    )


def ensure_provider_operable(provider: PaymentProvider | None) -> PaymentProvider:
    if provider is None:
        raise MercadoPagoAPIError("Mercado Pago is not configured by the platform")
    if not provider.enabled:
        raise MercadoPagoAPIError("Mercado Pago is disabled by the platform configuration")
    if not provider.client_id or not provider.client_secret_encrypted or not provider.redirect_uri:
        raise MercadoPagoAPIError("Mercado Pago is not configured by the platform")
    if not settings.mercadopago_simulated and not provider_webhook_secret_configured(provider):
        raise MercadoPagoAPIError("Mercado Pago webhook secret is not configured by the platform")
    return provider


def provider_webhook_secret_configured(provider: PaymentProvider | None) -> bool:
    encrypted_secret = getattr(provider, "webhook_secret_encrypted", None) if provider is not None else None
    if not encrypted_secret:
        return False
    if settings.mercadopago_simulated:
        return True
    try:
        return decrypt_sensitive_value(encrypted_secret) != SIMULATED_WEBHOOK_SECRET
    except Exception:
        return False


def get_store_payment_account(store: object, provider: str = MERCADOPAGO_PROVIDER) -> MerchantPaymentAccount | None:
    for account in list(getattr(store, "payment_accounts", []) or []):
        if getattr(account, "provider", None) == provider:
            return account
    session = object_session(store)
    if session is None or getattr(store, "id", None) is None:
        return None
    return session.scalar(
        select(MerchantPaymentAccount).where(
            MerchantPaymentAccount.store_id == getattr(store, "id"),
            MerchantPaymentAccount.provider == provider,
        )
    )


def ensure_store_payment_account(
    store: object, provider: str = MERCADOPAGO_PROVIDER
) -> MerchantPaymentAccount:
    account = get_store_payment_account(store, provider=provider)
    if account is not None:
        return account

    session = object_session(store)
    if session is None or getattr(store, "id", None) is None:
        raise MercadoPagoAPIError("Store payment account record is not available")

    account = MerchantPaymentAccount(store_id=getattr(store, "id"), provider=provider)
    session.add(account)
    session.flush()
    payment_accounts = getattr(store, "payment_accounts", None)
    if isinstance(payment_accounts, list):
        payment_accounts.append(account)
    return account


def _account_mode_matches_provider(account: object | None, provider: PaymentProvider | None = None) -> bool:
    if account is None or provider is None:
        return True
    live_mode = getattr(account, "live_mode", None)
    provider_mode = _normalize_provider_mode(getattr(provider, "mode", "sandbox"))
    if live_mode is None:
        return provider_mode == "sandbox"
    return bool(live_mode) == (provider_mode == "production")


def mercadopago_connection_status(store: object, provider: PaymentProvider | None = None) -> str:
    account = get_store_payment_account(store)
    if account is None:
        return "disconnected"
    if bool(getattr(account, "reconnect_required", False)):
        return "reconnect_required"
    if (
        bool(getattr(account, "connected", False))
        and getattr(account, "access_token_encrypted", None)
        and getattr(account, "refresh_token_encrypted", None)
    ):
        if not _account_mode_matches_provider(account, provider):
            return "reconnect_required"
        if not bool(getattr(account, "onboarding_completed", False)):
            return "onboarding_pending"
        return "connected"
    return "disconnected"


def is_store_mercadopago_ready(
    store: object, provider: PaymentProvider | None = None
) -> bool:
    account = get_store_payment_account(store)
    resolved_provider = provider
    if resolved_provider is None:
        session = object_session(store)
        if session is not None:
            resolved_provider = get_or_create_mercadopago_provider(session)
    return bool(
        is_provider_operable(resolved_provider)
        and account
        and account.public_key
        and bool(getattr(account, "onboarding_completed", False))
        and mercadopago_connection_status(store, provider=resolved_provider) == "connected"
    )


def get_store_access_token(store: object) -> str:
    account = get_store_payment_account(store)
    if account is None or not account.access_token_encrypted:
        raise MercadoPagoAPIError("Mercado Pago credentials are not configured for this store")
    try:
        return decrypt_sensitive_value(account.access_token_encrypted)
    except Exception as exc:  # pragma: no cover - defensive path
        raise MercadoPagoAPIError("Mercado Pago access token could not be decrypted") from exc


def get_store_refresh_token(store: object) -> str:
    account = get_store_payment_account(store)
    if account is None or not account.refresh_token_encrypted:
        raise MercadoPagoAPIError("Mercado Pago refresh token is not configured for this store")
    try:
        return decrypt_sensitive_value(account.refresh_token_encrypted)
    except Exception as exc:  # pragma: no cover - defensive path
        raise MercadoPagoAPIError("Mercado Pago refresh token could not be decrypted") from exc


def get_provider_client_secret(provider: PaymentProvider) -> str:
    if not provider.client_secret_encrypted:
        raise MercadoPagoAPIError("Mercado Pago OAuth client secret is not configured")
    try:
        return decrypt_sensitive_value(provider.client_secret_encrypted)
    except Exception as exc:  # pragma: no cover - defensive path
        raise MercadoPagoAPIError("Mercado Pago OAuth client secret could not be decrypted") from exc


def get_provider_webhook_secret(provider: PaymentProvider) -> str:
    if not provider_webhook_secret_configured(provider):
        raise MercadoPagoAPIError("Mercado Pago webhook secret is not configured")
    try:
        return decrypt_sensitive_value(provider.webhook_secret_encrypted)
    except Exception as exc:  # pragma: no cover - defensive path
        raise MercadoPagoAPIError("Mercado Pago webhook secret could not be decrypted") from exc


def _oauth_token_payload(data: dict[str, Any]) -> dict[str, Any]:
    expires_in = int(data.get("expires_in") or 0)
    expires_at = _now_utc() + timedelta(seconds=expires_in) if expires_in > 0 else None
    live_mode = data.get("live_mode")
    if isinstance(live_mode, str):
        live_mode = live_mode.strip().lower() in {"1", "true", "yes", "production"}
    return {
        "public_key": data.get("public_key"),
        "access_token": data.get("access_token"),
        "refresh_token": data.get("refresh_token"),
        "mp_user_id": str(data.get("user_id")) if data.get("user_id") is not None else None,
        "scope": data.get("scope"),
        "live_mode": live_mode,
        "expires_in": expires_in or None,
        "token_expires_at": expires_at,
    }


def _persist_reconnect_required(store_id: int) -> None:
    db = SessionLocal()
    try:
        account = db.scalar(
            select(MerchantPaymentAccount).where(
                MerchantPaymentAccount.store_id == store_id,
                MerchantPaymentAccount.provider == MERCADOPAGO_PROVIDER,
            )
        )
        if account is None:
            return
        account.reconnect_required = True
        account.connected = False
        db.commit()
        logger.warning("mercadopago_reconnect_required", extra={"store_id": store_id})
    finally:
        db.close()


def store_oauth_credentials(store: object, data: dict[str, Any]) -> None:
    account = ensure_store_payment_account(store)
    payload = _oauth_token_payload(data)

    access_token = str(payload["access_token"] or "").strip()
    refresh_token = payload["refresh_token"]
    if not refresh_token and account.refresh_token_encrypted:
        refresh_token = decrypt_sensitive_value(account.refresh_token_encrypted)
    refresh_token = str(refresh_token or "").strip()
    public_key = str(payload["public_key"] or account.public_key or "").strip()
    mp_user_id = str(payload["mp_user_id"] or account.mp_user_id or "").strip()

    missing_fields = []
    if not access_token:
        missing_fields.append("access_token")
    if not refresh_token:
        missing_fields.append("refresh_token")
    if not public_key:
        missing_fields.append("public_key")
    if not mp_user_id:
        missing_fields.append("user_id")
    if missing_fields:
        raise MercadoPagoAPIError(
            f"Mercado Pago OAuth response is missing required fields: {', '.join(missing_fields)}"
        )

    account.public_key = public_key
    account.access_token_encrypted = encrypt_sensitive_value(access_token)
    account.refresh_token_encrypted = encrypt_sensitive_value(refresh_token)
    account.mp_user_id = mp_user_id
    account.scope = payload["scope"] or account.scope
    account.live_mode = payload["live_mode"] if payload["live_mode"] is not None else account.live_mode
    account.expires_in = payload["expires_in"]
    account.token_expires_at = payload["token_expires_at"]
    account.connected = True
    account.onboarding_completed = True
    account.reconnect_required = False


def disconnect_store_account(store: object) -> None:
    account = ensure_store_payment_account(store)
    account.public_key = None
    account.access_token_encrypted = None
    account.refresh_token_encrypted = None
    account.mp_user_id = None
    account.scope = None
    account.live_mode = None
    account.expires_in = None
    account.token_expires_at = None
    account.connected = False
    account.onboarding_completed = False
    account.reconnect_required = False


def build_oauth_state(*, store_id: int, user_id: int, frontend_origin: str | None = None) -> str:
    payload = {
        "kind": "mercadopago_oauth",
        "provider": MERCADOPAGO_PROVIDER,
        "store_id": store_id,
        "user_id": user_id,
        "frontend_origin": normalize_frontend_origin(frontend_origin),
        "exp": _now_utc() + timedelta(minutes=OAUTH_STATE_EXPIRATION_MINUTES),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_oauth_state(state: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(state, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise MercadoPagoAPIError("Mercado Pago OAuth state is invalid") from exc
    if payload.get("kind") != "mercadopago_oauth" or payload.get("provider") != MERCADOPAGO_PROVIDER:
        raise MercadoPagoAPIError("Mercado Pago OAuth state is invalid")
    return payload


def build_oauth_session_token(*, store_id: int, user_id: int, frontend_origin: str | None = None) -> str:
    payload = {
        "kind": "mercadopago_oauth_session",
        "provider": MERCADOPAGO_PROVIDER,
        "store_id": store_id,
        "user_id": user_id,
        "frontend_origin": normalize_frontend_origin(frontend_origin),
        "exp": _now_utc() + timedelta(minutes=OAUTH_SESSION_EXPIRATION_MINUTES),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_oauth_session_token(value: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(value, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise MercadoPagoAPIError("Mercado Pago OAuth session is invalid") from exc
    if payload.get("kind") != "mercadopago_oauth_session" or payload.get("provider") != MERCADOPAGO_PROVIDER:
        raise MercadoPagoAPIError("Mercado Pago OAuth session is invalid")
    return payload


def oauth_connect_entrypoint(*, base_url: str | None = None) -> str:
    resolved_base_url = resolve_public_backend_base_url(base_url)
    return f"{resolved_base_url}{settings.api_prefix}/oauth/mercadopago/connect"


def build_oauth_callback_url(*, base_url: str | None = None) -> str:
    resolved_base_url = resolve_public_backend_base_url(base_url)
    return f"{resolved_base_url}{settings.api_prefix}/oauth/mercadopago/callback"


def build_oauth_connect_url(*, provider: PaymentProvider, state: str, base_url: str | None = None) -> str:
    ensure_provider_operable(provider)
    if settings.mercadopago_simulated:
        base = resolve_public_backend_base_url(base_url)
        query = urlencode({"code": "SIMULATED-OAUTH", "state": state})
        return f"{base}{settings.api_prefix}/oauth/mercadopago/callback?{query}"

    callback_url = build_oauth_callback_url(base_url=base_url)
    if is_internal_http_url(provider.redirect_uri) and not is_internal_http_url(callback_url):
        raise MercadoPagoAPIError(
            "Mercado Pago Redirect URI is configured as localhost/internal. "
            f"Configure {callback_url} in Admin and in the Mercado Pago application Redirect URL."
        )

    query = urlencode(
        {
            "client_id": provider.client_id,
            "response_type": "code",
            "platform_id": "mp",
            "redirect_uri": provider.redirect_uri,
            "state": state,
        }
    )
    return f"{settings.mercadopago_auth_base_url.rstrip('/')}/authorization?{query}"


def exchange_oauth_code(code: str, provider: PaymentProvider) -> dict[str, Any]:
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

    provider = ensure_provider_operable(provider)

    try:
        response = httpx.post(
            f"{settings.mercadopago_api_base_url.rstrip('/')}/oauth/token",
            headers=_oauth_form_headers(),
            data={
                "client_id": provider.client_id,
                "client_secret": get_provider_client_secret(provider),
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": provider.redirect_uri,
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
    session = object_session(store)
    if session is None:
        raise MercadoPagoAPIError("Mercado Pago OAuth is not configured for this store")
    provider = ensure_provider_operable(get_or_create_mercadopago_provider(session))

    store_id = getattr(store, "id")
    refresh_token = get_store_refresh_token(store)
    try:
        response = httpx.post(
            f"{settings.mercadopago_api_base_url.rstrip('/')}/oauth/token",
            headers=_oauth_form_headers(),
            data={
                "client_id": provider.client_id,
                "client_secret": get_provider_client_secret(provider),
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
                "redirect_uri": provider.redirect_uri,
            },
            timeout=settings.mercadopago_timeout_seconds,
        )
    except httpx.HTTPError as exc:
        _persist_reconnect_required(store_id)
        logger.exception("mercadopago_refresh_failed", extra={"store_id": store_id})
        raise MercadoPagoAPIError(f"Mercado Pago token refresh failed: {exc}") from exc

    if response.status_code != 200:
        _persist_reconnect_required(store_id)
        logger.warning(
            "mercadopago_refresh_rejected",
            extra={"store_id": store_id, "status_code": response.status_code},
        )
        raise MercadoPagoAPIError(
            f"Mercado Pago token refresh failed ({response.status_code}): {response.text}"
        )

    store_oauth_credentials(store, response.json())
    return get_store_access_token(store)


def ensure_valid_store_access_token(store: object) -> str:
    session = object_session(store)
    provider = get_or_create_mercadopago_provider(session) if session is not None else None
    if mercadopago_connection_status(store, provider=provider) != "connected":
        raise MercadoPagoAPIError("Mercado Pago OAuth connection is not active for this store")

    account = get_store_payment_account(store)
    if account is None:
        raise MercadoPagoAPIError("Mercado Pago credentials are not configured for this store")

    token_expires_at = _ensure_utc_datetime(getattr(account, "token_expires_at", None))
    if token_expires_at is None:
        return get_store_access_token(store)
    if token_expires_at <= (_now_utc() + timedelta(minutes=5)):
        return refresh_store_access_token(store)
    return get_store_access_token(store)


def _request_with_store_token_retry(
    *,
    store: object,
    method: str,
    url: str,
    expected_statuses: set[int],
    json_payload: dict[str, Any] | None = None,
) -> httpx.Response:
    access_token = ensure_valid_store_access_token(store)
    try:
        response = httpx.request(
            method,
            url,
            headers=_build_headers(access_token),
            json=json_payload,
            timeout=settings.mercadopago_timeout_seconds,
        )
    except httpx.HTTPError as exc:
        raise MercadoPagoAPIError(f"Mercado Pago request failed: {exc}") from exc

    if response.status_code == 401:
        logger.warning(
            "mercadopago_request_unauthorized",
            extra={"store_id": getattr(store, "id", None), "url": url},
        )
        refreshed_token = refresh_store_access_token(store)
        try:
            response = httpx.request(
                method,
                url,
                headers=_build_headers(refreshed_token),
                json=json_payload,
                timeout=settings.mercadopago_timeout_seconds,
            )
        except httpx.HTTPError as exc:
            raise MercadoPagoAPIError(f"Mercado Pago request failed after token refresh: {exc}") from exc
        if response.status_code == 401:
            _persist_reconnect_required(getattr(store, "id"))

    if response.status_code not in expected_statuses:
        raise MercadoPagoAPIError(
            f"Mercado Pago request failed ({response.status_code}): {response.text}"
        )
    return response


def build_notification_url(store_id: int, reference: str) -> str:
    base = settings.backend_base_url.rstrip("/")
    query = urlencode({"store_id": store_id, "reference": reference})
    return f"{base}{settings.api_prefix}/payments/mercadopago/webhook?{query}"


def build_webhook_url() -> str:
    base = settings.backend_base_url.rstrip("/")
    return f"{base}{settings.api_prefix}/payments/mercadopago/webhook"


def build_order_return_url(order_id: int) -> str:
    return f"{settings.frontend_base_url.rstrip('/')}/c/pedido/{order_id}"


def create_checkout_preference(
    *,
    store: object,
    payer_email: str,
    order_id: int,
    reference: str,
    items: list[dict[str, Any]],
    marketplace_fee: float,
    fallback_items: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    session = object_session(store)
    if session is None:
        raise MercadoPagoAPIError("Mercado Pago provider configuration is unavailable")
    provider = ensure_provider_operable(get_or_create_mercadopago_provider(session))

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
            "platform": "kepedimos",
        },
    }
    allow_promotions_retry = fallback_items is not None and any(
        float(item.get("unit_price") or 0) < 0 for item in items
    )
    response = _request_with_store_token_retry(
        store=store,
        method="POST",
        url=f"{settings.mercadopago_api_base_url.rstrip('/')}/checkout/preferences",
        expected_statuses={200, 201, 400} if allow_promotions_retry else {200, 201},
        json_payload=payload,
    )
    if response.status_code == 400 and fallback_items is not None:
        logger.warning(
            "mercadopago_preference_retry_prorated_promotions",
            extra={"store_id": getattr(store, "id", None), "order_id": order_id},
        )
        payload["items"] = fallback_items
        response = _request_with_store_token_retry(
            store=store,
            method="POST",
            url=f"{settings.mercadopago_api_base_url.rstrip('/')}/checkout/preferences",
            expected_statuses={200, 201},
            json_payload=payload,
        )
    data = response.json()
    checkout_url = (
        data.get("sandbox_init_point")
        if _normalize_provider_mode(provider.mode) == "sandbox"
        else data.get("init_point")
    ) or data.get("init_point") or data.get("sandbox_init_point")
    if not checkout_url:
        raise MercadoPagoAPIError("Mercado Pago preference response did not include a checkout URL")
    return {
        "id": data.get("id"),
        "checkout_url": checkout_url,
        "raw": data,
    }


def fetch_payment(payment_id: str | int, store: object) -> dict[str, Any]:
    response = _request_with_store_token_retry(
        store=store,
        method="GET",
        url=f"{settings.mercadopago_api_base_url.rstrip('/')}/v1/payments/{payment_id}",
        expected_statuses={200},
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
