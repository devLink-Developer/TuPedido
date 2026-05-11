from __future__ import annotations

import json
import math
from typing import Literal


CoverageMode = Literal["delivery", "pickup"]
CoveragePoint = dict[str, float]

MIN_POLYGON_POINTS = 3
EPSILON = 1e-9


class CoveragePolygonError(ValueError):
    pass


def _is_number(value: object) -> bool:
    return not isinstance(value, bool) and isinstance(value, (int, float)) and math.isfinite(float(value))


def _normalize_point(value: object, *, index: int) -> CoveragePoint:
    if not isinstance(value, dict):
        raise CoveragePolygonError(f"Polygon point #{index + 1} must be an object")

    latitude = value.get("latitude")
    longitude = value.get("longitude")
    if not _is_number(latitude) or not _is_number(longitude):
        raise CoveragePolygonError(f"Polygon point #{index + 1} has invalid coordinates")

    normalized_latitude = float(latitude)
    normalized_longitude = float(longitude)
    if normalized_latitude < -90 or normalized_latitude > 90:
        raise CoveragePolygonError(f"Polygon point #{index + 1} latitude is out of range")
    if normalized_longitude < -180 or normalized_longitude > 180:
        raise CoveragePolygonError(f"Polygon point #{index + 1} longitude is out of range")

    return {
        "latitude": round(normalized_latitude, 7),
        "longitude": round(normalized_longitude, 7),
    }


def normalize_coverage_polygon(value: object | None) -> list[CoveragePoint]:
    if value in (None, ""):
        return []

    raw_value = value
    if isinstance(value, str):
        try:
            raw_value = json.loads(value)
        except json.JSONDecodeError as exc:
            raise CoveragePolygonError("Polygon JSON is invalid") from exc

    if raw_value in (None, ""):
        return []
    if not isinstance(raw_value, list):
        raise CoveragePolygonError("Polygon must be a list of coordinates")

    points = [_normalize_point(point, index=index) for index, point in enumerate(raw_value)]
    if not points:
        return []

    if len(points) > 1 and points[0] == points[-1]:
        points = points[:-1]

    unique_points = {(point["latitude"], point["longitude"]) for point in points}
    if len(points) < MIN_POLYGON_POINTS or len(unique_points) < MIN_POLYGON_POINTS:
        raise CoveragePolygonError("Polygon must have at least three different points")

    return points


def coverage_polygon_to_json(value: object | None) -> str | None:
    points = normalize_coverage_polygon(value)
    if not points:
        return None
    return json.dumps(points, ensure_ascii=True, separators=(",", ":"))


def safe_coverage_polygon(value: object | None) -> list[CoveragePoint]:
    try:
        return normalize_coverage_polygon(value)
    except CoveragePolygonError:
        return []


def effective_coverage_polygon(store: object, mode: CoverageMode) -> list[CoveragePoint]:
    settings = getattr(store, "delivery_settings", None)
    if settings is None:
        return []

    if mode == "pickup" and bool(getattr(settings, "pickup_area_uses_delivery_area", False)):
        return safe_coverage_polygon(getattr(settings, "delivery_area_polygon_json", None))

    field_name = "delivery_area_polygon_json" if mode == "delivery" else "pickup_area_polygon_json"
    return safe_coverage_polygon(getattr(settings, field_name, None))


def store_mode_has_configured_polygon(store: object, mode: CoverageMode) -> bool:
    settings = getattr(store, "delivery_settings", None)
    if settings is None:
        return False

    if mode == "delivery" and not bool(getattr(settings, "delivery_enabled", False)):
        return False
    if mode == "pickup" and not bool(getattr(settings, "pickup_enabled", False)):
        return False

    return bool(effective_coverage_polygon(store, mode))


def store_has_any_configured_polygon(store: object) -> bool:
    return store_mode_has_configured_polygon(store, "delivery") or store_mode_has_configured_polygon(store, "pickup")


def _point_on_segment(
    point_latitude: float,
    point_longitude: float,
    start: CoveragePoint,
    end: CoveragePoint,
) -> bool:
    point_x = point_longitude
    point_y = point_latitude
    start_x = start["longitude"]
    start_y = start["latitude"]
    end_x = end["longitude"]
    end_y = end["latitude"]

    cross = (point_y - start_y) * (end_x - start_x) - (point_x - start_x) * (end_y - start_y)
    if abs(cross) > EPSILON:
        return False

    min_x, max_x = sorted((start_x, end_x))
    min_y, max_y = sorted((start_y, end_y))
    return min_x - EPSILON <= point_x <= max_x + EPSILON and min_y - EPSILON <= point_y <= max_y + EPSILON


def point_in_polygon(latitude: float, longitude: float, polygon: list[CoveragePoint]) -> bool:
    if not polygon:
        return False

    inside = False
    point_x = longitude
    point_y = latitude
    previous = polygon[-1]

    for current in polygon:
        if _point_on_segment(latitude, longitude, previous, current):
            return True

        current_x = current["longitude"]
        current_y = current["latitude"]
        previous_x = previous["longitude"]
        previous_y = previous["latitude"]

        crosses_ray = (current_y > point_y) != (previous_y > point_y)
        if crosses_ray:
            intersection_x = (previous_x - current_x) * (point_y - current_y) / (previous_y - current_y) + current_x
            if point_x <= intersection_x + EPSILON:
                inside = not inside

        previous = current

    return inside


def store_covers_location(store: object, mode: CoverageMode, *, latitude: float, longitude: float) -> bool:
    polygon = effective_coverage_polygon(store, mode)
    return point_in_polygon(latitude, longitude, polygon)


def has_valid_coordinates(latitude: object | None, longitude: object | None) -> bool:
    return (
        _is_number(latitude)
        and _is_number(longitude)
        and -90 <= float(latitude) <= 90
        and -180 <= float(longitude) <= 180
    )
