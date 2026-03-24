from __future__ import annotations

import asyncio
import logging

from app.db.session import SessionLocal
from app.services.delivery import expire_pending_offers, mark_stale_tracking

logger = logging.getLogger(__name__)


def run_delivery_maintenance_once() -> None:
    db = SessionLocal()
    try:
        expired = expire_pending_offers(db)
        stale = mark_stale_tracking(db)
        if expired or stale:
            db.commit()
    except Exception:
        db.rollback()
        logger.exception("Delivery maintenance failed")
    finally:
        db.close()


async def run_delivery_maintenance_loop(interval_seconds: int = 5) -> None:
    while True:
        run_delivery_maintenance_once()
        await asyncio.sleep(interval_seconds)
