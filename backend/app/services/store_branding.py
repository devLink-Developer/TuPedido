from __future__ import annotations

from collections.abc import Iterable

from app.models.store import Category

GENERIC_ASSETS = {
    "logo_url": "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=400&q=80",
    "cover_image_url": "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80",
}

STORE_ASSETS_BY_KEY = {
    "farmacia": {
        "logo_url": "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=400&q=80",
        "cover_image_url": "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=1200&q=80",
    },
    "despensa": {
        "logo_url": "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80",
        "cover_image_url": "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80",
    },
    "kiosco": {
        "logo_url": "https://images.unsplash.com/photo-1511556532299-8f662fc26c06?auto=format&fit=crop&w=400&q=80",
        "cover_image_url": "https://images.unsplash.com/photo-1511556532299-8f662fc26c06?auto=format&fit=crop&w=1200&q=80",
    },
    "restaurante": {
        "logo_url": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=400&q=80",
        "cover_image_url": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
    },
    "parrilla": {
        "logo_url": "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=400&q=80",
        "cover_image_url": "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1200&q=80",
    },
    "pizzeria": {
        "logo_url": "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&q=80",
        "cover_image_url": "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1200&q=80",
    },
    "carniceria": {
        "logo_url": "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=400&q=80",
        "cover_image_url": "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=1200&q=80",
    },
    "polleria": {
        "logo_url": "https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=400&q=80",
        "cover_image_url": "https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=1200&q=80",
    },
    "mascotas": {
        "logo_url": "https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=400&q=80",
        "cover_image_url": "https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=1200&q=80",
    },
}


def _category_keys(categories: Iterable[Category]) -> list[str]:
    values: list[str] = []
    for category in categories:
        values.append((category.slug or "").strip().lower())
        values.append((category.name or "").strip().lower())
    return values


def resolve_store_assets(categories: Iterable[Category]) -> dict[str, str]:
    values = _category_keys(categories)

    checks = (
        ("farmacia", ("farmacia", "farmacia de turno")),
        ("despensa", ("despensa", "almacen")),
        ("kiosco", ("kiosco",)),
        ("restaurante", ("restaurante",)),
        ("parrilla", ("parrilla",)),
        ("pizzeria", ("pizzeria", "pizza")),
        ("carniceria", ("carniceria",)),
        ("polleria", ("polleria",)),
        ("mascotas", ("mascotas", "petshop")),
    )

    for asset_key, terms in checks:
        if any(any(term in value for term in terms) for value in values):
            return STORE_ASSETS_BY_KEY[asset_key]

    return GENERIC_ASSETS
