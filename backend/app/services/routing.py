from __future__ import annotations

import math
from dataclasses import dataclass

import httpx

from app.core.config import settings
from app.schemas.routing import RouteCoordinate, RouteInstruction, RouteProfile


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
    instructions: list[RouteInstruction]


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
        "instructions": True,
        "language": "es",
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
    properties = feature.get("properties") or {}
    summary = properties.get("summary") or {}
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

    instructions: list[RouteInstruction] = []
    segments = properties.get("segments") or []
    for segment in segments:
        if not isinstance(segment, dict):
            continue
        steps = segment.get("steps") or []
        for step in steps:
            if not isinstance(step, dict):
                continue
            instruction = str(step.get("instruction") or "").strip()
            if not instruction:
                continue
            step_duration = float(step.get("duration") or 0)
            way_points = step.get("way_points") or []
            instructions.append(
                RouteInstruction(
                    instruction=instruction,
                    name=str(step.get("name") or "").strip() or None,
                    distance_meters=float(step.get("distance") or 0),
                    duration_seconds=step_duration,
                    duration_minutes=duration_minutes(step_duration),
                    type=int(step["type"]) if isinstance(step.get("type"), int) else None,
                    way_points=[int(point) for point in way_points if isinstance(point, int)],
                )
            )

    return DirectionsResult(
        profile=profile,
        distance_meters=distance,
        duration_seconds=duration,
        geometry=geometry,
        instructions=instructions,
    )


def duration_minutes(duration_seconds: float) -> int:
    return max(1, math.ceil(duration_seconds / 60))
