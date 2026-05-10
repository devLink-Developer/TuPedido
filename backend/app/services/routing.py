from __future__ import annotations

import math
from dataclasses import dataclass

import httpx

from app.core.config import settings
from app.schemas.routing import RouteCoordinate, RouteProfile


class RoutingError(RuntimeError):
    pass


class RoutingNotConfigured(RoutingError):
    pass


@dataclass(frozen=True)
class DirectionsResult:
    profile: RouteProfile
    distance_meters: float
    duration_seconds: float
    geometry: list[RouteCoordinate]


def fetch_directions(profile: RouteProfile, coordinates: list[RouteCoordinate]) -> DirectionsResult:
    api_key = settings.openrouteservice_api_key
    if not api_key:
        raise RoutingNotConfigured("OpenRouteService no esta configurado.")

    ors_coordinates = [[point.longitude, point.latitude] for point in coordinates]
    url = f"{settings.openrouteservice_base_url.rstrip('/')}/v2/directions/{profile}/geojson"
    headers = {
        "Accept": "application/json, application/geo+json",
        "Authorization": api_key,
        "Content-Type": "application/json",
    }
    payload = {
        "coordinates": ors_coordinates,
        "instructions": False,
    }

    try:
        with httpx.Client(timeout=settings.openrouteservice_timeout_seconds, follow_redirects=True) as client:
            response = client.post(url, headers=headers, json=payload)
    except httpx.HTTPError as exc:
        raise RoutingError("No se pudo consultar OpenRouteService en este momento.") from exc

    if response.status_code == 401:
        raise RoutingError("OpenRouteService rechazo la API key configurada.")
    if response.status_code == 429:
        raise RoutingError("OpenRouteService esta limitando temporalmente las consultas.")
    if response.status_code >= 400:
        raise RoutingError("OpenRouteService no pudo calcular la ruta.")

    data = response.json()
    features = data.get("features") or []
    if not features:
        raise RoutingError("OpenRouteService no devolvio una ruta utilizable.")

    feature = features[0]
    summary = (feature.get("properties") or {}).get("summary") or {}
    raw_geometry = (feature.get("geometry") or {}).get("coordinates") or []
    geometry: list[RouteCoordinate] = []
    for item in raw_geometry:
        if not isinstance(item, (list, tuple)) or len(item) < 2:
            continue
        longitude, latitude = item[0], item[1]
        if not isinstance(latitude, (int, float)) or not isinstance(longitude, (int, float)):
            continue
        geometry.append(RouteCoordinate(latitude=float(latitude), longitude=float(longitude)))

    distance = float(summary.get("distance") or 0)
    duration = float(summary.get("duration") or 0)
    if not geometry or distance <= 0 or duration <= 0:
        raise RoutingError("OpenRouteService devolvio una ruta incompleta.")

    return DirectionsResult(
        profile=profile,
        distance_meters=distance,
        duration_seconds=duration,
        geometry=geometry,
    )


def duration_minutes(duration_seconds: float) -> int:
    return max(1, math.ceil(duration_seconds / 60))
