from __future__ import annotations

import logging
from urllib.parse import urlencode, urlsplit

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from fastapi import APIRouter, Cookie, Depends, Request, Response, status
from fastapi.responses import RedirectResponse

from app.api.deps import require_merchant
from app.core.config import settings
from app.db.session import get_db
from app.models.store import Store, StorePaymentSettings
from app.models.user import User
from app.schemas.merchant import MercadoPagoConnectUrlRead
from app.services.mercadopago import (
    MercadoPagoAPIError,
    build_oauth_connect_url,
    build_oauth_session_token,
    build_oauth_state,
    decode_oauth_session_token,
    decode_oauth_state,
    disconnect_store_account,
    exchange_oauth_code,
    get_or_create_mercadopago_provider,
    mercadopago_connection_status,
    normalize_frontend_origin,
    oauth_connect_entrypoint,
    store_oauth_credentials,
)

logger = logging.getLogger(__name__)

router = APIRouter()

OAUTH_SESSION_COOKIE = "mp_oauth_session"

STORE_OPTIONS = (
    selectinload(Store.payment_settings),
    selectinload(Store.payment_accounts),
)


def _oauth_cookie_path() -> str:
    return f"{settings.api_prefix}/oauth/mercadopago"


def _merchant_redirect_url(status_value: str, detail: str | None = None) -> str:
    base = f"{settings.frontend_base_url.rstrip('/')}/m/configuracion"
    query = {"mercadopago_oauth": status_value}
    if detail:
        query["detail"] = detail
    return f"{base}?{urlencode(query)}"


def _cookie_secure(request: Request) -> bool:
    return request.url.scheme == "https" or settings.frontend_base_url.startswith("https://")


def _frontend_origin_from_request(request: Request) -> str:
    for candidate in (request.headers.get("origin"), request.headers.get("referer")):
        if not candidate:
            continue
        try:
            parsed = urlsplit(candidate)
        except ValueError:
            continue
        if parsed.scheme in {"http", "https"} and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}"
    return settings.frontend_base_url.rstrip("/")


def _api_base_url_from_request(request: Request) -> str:
    return str(request.base_url).rstrip("/")


def _merchant_redirect_url_for_origin(origin: str | None, status_value: str, detail: str | None = None) -> str:
    base = f"{normalize_frontend_origin(origin)}/m/configuracion"
    query = {"mercadopago_oauth": status_value}
    if detail:
        query["detail"] = detail
    return f"{base}?{urlencode(query)}"


def _clear_oauth_cookie(response: Response) -> None:
    response.delete_cookie(OAUTH_SESSION_COOKIE, path=_oauth_cookie_path())


def _set_oauth_cookie(request: Request, response: Response, value: str) -> None:
    response.set_cookie(
        OAUTH_SESSION_COOKIE,
        value=value,
        httponly=True,
        secure=_cookie_secure(request),
        samesite="lax",
        max_age=60 * 10,
        path=_oauth_cookie_path(),
    )


def _get_merchant_store(db: Session, user_id: int) -> Store:
    store = db.scalar(select(Store).options(*STORE_OPTIONS).where(Store.owner_user_id == user_id))
    if store is None:
        raise MercadoPagoAPIError("Merchant store not found")
    return store


@router.post("/mercadopago/session", response_model=MercadoPagoConnectUrlRead)
def create_mercadopago_oauth_session(
    request: Request,
    response: Response,
    user: User = Depends(require_merchant),
    db: Session = Depends(get_db),
) -> MercadoPagoConnectUrlRead:
    store = _get_merchant_store(db, user.id)
    get_or_create_mercadopago_provider(db)
    frontend_origin = _frontend_origin_from_request(request)
    token = build_oauth_session_token(store_id=store.id, user_id=user.id, frontend_origin=frontend_origin)
    _set_oauth_cookie(request, response, token)
    logger.info("mercadopago_oauth_session_created", extra={"store_id": store.id, "user_id": user.id})
    status_value = mercadopago_connection_status(store)
    return MercadoPagoConnectUrlRead(
        connect_url=oauth_connect_entrypoint(base_url=_api_base_url_from_request(request)),
        connection_status=status_value,
        status=status_value,
        callback_url=None,
    )


@router.get("/mercadopago/connect")
def connect_mercadopago(
    request: Request,
    oauth_session: str | None = Cookie(default=None, alias=OAUTH_SESSION_COOKIE),
    db: Session = Depends(get_db),
) -> RedirectResponse:
    try:
        if not oauth_session:
            raise MercadoPagoAPIError("Missing OAuth session")
        session_payload = decode_oauth_session_token(oauth_session)
        store = db.scalar(
            select(Store)
            .options(*STORE_OPTIONS)
            .where(
                Store.id == int(session_payload["store_id"]),
                Store.owner_user_id == int(session_payload["user_id"]),
            )
        )
        if store is None:
            raise MercadoPagoAPIError("Merchant store not found")
        provider = get_or_create_mercadopago_provider(db)
        state = build_oauth_state(
            store_id=store.id,
            user_id=int(session_payload["user_id"]),
            frontend_origin=session_payload.get("frontend_origin"),
        )
        return RedirectResponse(
            build_oauth_connect_url(
                provider=provider,
                state=state,
                base_url=_api_base_url_from_request(request),
            ),
            status_code=status.HTTP_302_FOUND,
        )
    except (MercadoPagoAPIError, ValueError) as exc:
        response = RedirectResponse(
            _merchant_redirect_url_for_origin(_frontend_origin_from_request(request), "error", str(exc)),
            status_code=status.HTTP_302_FOUND,
        )
        _clear_oauth_cookie(response)
        return response


@router.get("/mercadopago/callback")
def mercadopago_oauth_callback(
    _: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
    db: Session = Depends(get_db),
) -> RedirectResponse:
    payload: dict[str, object] | None = None
    if error:
        if state:
            try:
                payload = decode_oauth_state(state)
            except MercadoPagoAPIError:
                payload = None
        response = RedirectResponse(
            _merchant_redirect_url_for_origin(
                payload.get("frontend_origin") if payload else None,
                "error",
                error_description or error,
            ),
            status_code=status.HTTP_302_FOUND,
        )
        _clear_oauth_cookie(response)
        return response

    if not code or not state:
        response = RedirectResponse(
            _merchant_redirect_url("error", "Missing OAuth callback parameters"),
            status_code=status.HTTP_302_FOUND,
        )
        _clear_oauth_cookie(response)
        return response

    try:
        payload = decode_oauth_state(state)
        store = db.scalar(
            select(Store)
            .options(*STORE_OPTIONS)
            .where(Store.id == int(payload["store_id"]), Store.owner_user_id == int(payload["user_id"]))
        )
        if store is None:
            raise MercadoPagoAPIError("Merchant store not found for OAuth callback")

        provider = get_or_create_mercadopago_provider(db)
        token_payload = exchange_oauth_code(code, provider)
        store_oauth_credentials(store, token_payload)
        db.commit()
        logger.info(
            "mercadopago_oauth_connected",
            extra={"store_id": store.id, "user_id": int(payload["user_id"])},
        )
        response = RedirectResponse(
            _merchant_redirect_url_for_origin(payload.get("frontend_origin"), "connected"),
            status_code=status.HTTP_302_FOUND,
        )
        _clear_oauth_cookie(response)
        return response
    except (MercadoPagoAPIError, ValueError) as exc:
        db.rollback()
        logger.warning("mercadopago_oauth_callback_failed", extra={"detail": str(exc)})
        response = RedirectResponse(
            _merchant_redirect_url_for_origin(payload.get("frontend_origin") if payload else None, "error", str(exc)),
            status_code=status.HTTP_302_FOUND,
        )
        _clear_oauth_cookie(response)
        return response


@router.post("/mercadopago/disconnect")
def disconnect_mercadopago(
    user: User = Depends(require_merchant),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    store = _get_merchant_store(db, user.id)
    disconnect_store_account(store)
    if store.payment_settings is None:
        store.payment_settings = StorePaymentSettings(store_id=store.id)
        db.add(store.payment_settings)
    store.payment_settings.mercadopago_enabled = False
    db.commit()
    logger.info("mercadopago_oauth_disconnected", extra={"store_id": store.id, "user_id": user.id})
    return {"status": "disconnected"}
