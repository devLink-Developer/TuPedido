from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.order import StoreOrder
from app.models.payment import PaymentTransaction
from app.models.store import Store
from app.modules.payments.mercadopago.payment_service import sync_transaction_from_provider
from app.modules.payments.mercadopago.token_refresh_service import refresh_expiring_tokens_once
from app.services.mercadopago import MercadoPagoAPIError

logger = logging.getLogger(__name__)


def sync_mercadopago_payments_once(db: Session, *, limit: int = 100) -> int:
    stale_before = datetime.now(UTC) - timedelta(minutes=15)
    transactions = db.scalars(
        select(PaymentTransaction)
        .options(
            selectinload(PaymentTransaction.order),
            selectinload(PaymentTransaction.store).selectinload(Store.payment_accounts),
        )
        .where(
            PaymentTransaction.provider == "mercadopago",
            PaymentTransaction.payment_id.is_not(None),
            PaymentTransaction.status.in_(["pending", "processing", "paid"]),
            (
                (PaymentTransaction.last_sync_at.is_(None))
                | (PaymentTransaction.last_sync_at <= stale_before)
            ),
        )
        .order_by(PaymentTransaction.updated_at.asc())
        .limit(limit)
        .with_for_update(skip_locked=True, of=PaymentTransaction)
    ).all()

    synced = 0
    for transaction in transactions:
        try:
            if sync_transaction_from_provider(db, transaction):
                synced += 1
        except MercadoPagoAPIError as exc:
            transaction.last_error = str(exc)[:1000]
            transaction.retry_count = int(getattr(transaction, "retry_count", 0) or 0) + 1
            logger.warning("mercadopago_payment_sync_failed", extra={"transaction_id": transaction.id})
    return synced


def run_mercadopago_maintenance_once(db: Session) -> dict[str, int]:
    refreshed = refresh_expiring_tokens_once(db)
    synced = sync_mercadopago_payments_once(db)
    return {"tokens_refreshed": refreshed, "payments_synced": synced}
