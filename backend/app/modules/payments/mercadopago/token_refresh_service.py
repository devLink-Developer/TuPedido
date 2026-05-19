from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.store import MerchantPaymentAccount, Store
from app.services.mercadopago import MercadoPagoAPIError, refresh_store_access_token

logger = logging.getLogger(__name__)


def refresh_expiring_tokens_once(db: Session, *, threshold_minutes: int = 30, limit: int = 50) -> int:
    threshold = datetime.now(UTC) + timedelta(minutes=threshold_minutes)
    accounts = db.scalars(
        select(MerchantPaymentAccount)
        .options(selectinload(MerchantPaymentAccount.store).selectinload(Store.payment_accounts))
        .where(
            MerchantPaymentAccount.provider == "mercadopago",
            MerchantPaymentAccount.connected.is_(True),
            MerchantPaymentAccount.refresh_token_encrypted.is_not(None),
            MerchantPaymentAccount.reconnect_required.is_(False),
            MerchantPaymentAccount.token_expires_at.is_not(None),
            MerchantPaymentAccount.token_expires_at <= threshold,
        )
        .order_by(MerchantPaymentAccount.token_expires_at.asc())
        .limit(limit)
        .with_for_update(skip_locked=True, of=MerchantPaymentAccount)
    ).all()

    refreshed = 0
    for account in accounts:
        if account.store is None:
            continue
        try:
            refresh_store_access_token(account.store)
            refreshed += 1
        except MercadoPagoAPIError as exc:
            account.last_refresh_error = str(exc)[:1000]
            account.status = "expired"
            account.reconnect_required = True
            account.connected = False
            logger.warning("mercadopago_token_refresh_job_failed", extra={"store_id": account.store_id})
    return refreshed
