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


def store_delivery_is_enabled(store: object) -> bool:
    settings = getattr(store, "delivery_settings", None)
    return bool(
        settings
        and getattr(settings, "delivery_enabled", False)
        and store_has_configured_delivery_address(store)
        and store_mode_has_configured_polygon(store, "delivery")
    )


def store_pickup_is_enabled(store: object) -> bool:
    settings = getattr(store, "delivery_settings", None)
    return bool(settings and getattr(settings, "pickup_enabled", False) and store_mode_has_configured_polygon(store, "pickup"))


def store_can_receive_orders_by_configuration(store: object) -> bool:
    return store_delivery_is_enabled(store) or store_pickup_is_enabled(store)
