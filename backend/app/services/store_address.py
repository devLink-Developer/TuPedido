from __future__ import annotations

from app.services.store_coverage import store_mode_has_configured_polygon


def _compact(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = " ".join(value.split()).strip()
    return normalized or None


def build_store_address(
    *,
    street_line: str,
    locality: str | None = None,
    province: str | None = None,
    postal_code: str | None = None,
) -> str:
    parts = [_compact(street_line), _compact(locality), _compact(province), _compact(postal_code)]
    return ", ".join(part for part in parts if part)


def store_has_configured_delivery_address(store: object) -> bool:
    return bool(
        _compact(getattr(store, "address", None))
        and _compact(getattr(store, "postal_code", None))
        and _compact(getattr(store, "province", None))
        and _compact(getattr(store, "locality", None))
        and getattr(store, "latitude", None) is not None
        and getattr(store, "longitude", None) is not None
    )


def _store_delivery_riders(store: object) -> list[object]:
    try:
        return list(getattr(store, "delivery_riders", []) or [])
    except Exception:
        return []


def store_configured_delivery_riders_count(store: object) -> int:
    return len(_store_delivery_riders(store))


def store_active_delivery_riders_count(store: object) -> int:
    active_count = 0
    for rider in _store_delivery_riders(store):
        if not getattr(rider, "is_active", False):
            continue
        user = getattr(rider, "user", None)
        if user is not None and not getattr(user, "is_active", True):
            continue
        active_count += 1
    return active_count


def store_has_active_delivery_rider(store: object) -> bool:
    return store_active_delivery_riders_count(store) > 0


def store_enabled_catalog_products_count(store: object) -> int:
    try:
        products = list(getattr(store, "products", []) or [])
    except Exception:
        return 0
    return sum(1 for product in products if getattr(product, "is_available", False))


def store_has_enabled_catalog_product(store: object) -> bool:
    return store_enabled_catalog_products_count(store) > 0


def store_delivery_unavailable_reason(store: object) -> str | None:
    settings = getattr(store, "delivery_settings", None)
    if not settings or not getattr(settings, "delivery_enabled", False):
        return "El envio no esta habilitado para este comercio."
    if not store_has_configured_delivery_address(store):
        return "Falta configurar la direccion exacta del comercio."
    if not store_mode_has_configured_polygon(store, "delivery"):
        return "Falta configurar el alcance de envio."
    if store_configured_delivery_riders_count(store) == 0:
        return "Falta configurar al menos un repartidor."
    if not store_has_active_delivery_rider(store):
        return "No hay repartidores activos para este comercio."
    return None


def store_delivery_is_enabled(store: object) -> bool:
    settings = getattr(store, "delivery_settings", None)
    return bool(
        settings
        and getattr(settings, "delivery_enabled", False)
        and store_has_configured_delivery_address(store)
        and store_mode_has_configured_polygon(store, "delivery")
        and store_has_active_delivery_rider(store)
    )


def store_pickup_is_enabled(store: object) -> bool:
    settings = getattr(store, "delivery_settings", None)
    return bool(settings and getattr(settings, "pickup_enabled", False) and store_mode_has_configured_polygon(store, "pickup"))


def store_can_receive_orders_by_configuration(store: object) -> bool:
    return store_has_enabled_catalog_product(store) and (store_delivery_is_enabled(store) or store_pickup_is_enabled(store))
