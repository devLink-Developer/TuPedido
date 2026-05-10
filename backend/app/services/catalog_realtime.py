from __future__ import annotations

import anyio

from app.models.store import Store
from app.services.realtime import realtime_hub


def publish_catalog_store_changed(store: Store, *, event_type: str = "catalog.stores.changed") -> None:
    payload = {
        "type": event_type,
        "store_id": store.id,
        "store_slug": store.slug,
        "status": store.status,
        "accepting_orders": store.accepting_orders,
    }
    try:
        anyio.from_thread.run(realtime_hub.broadcast_catalog, payload)
    except RuntimeError:
        pass
