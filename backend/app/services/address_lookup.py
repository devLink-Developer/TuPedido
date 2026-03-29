from __future__ import annotations

import re
from dataclasses import dataclass

import httpx

from app.core.config import settings

POSTAL_CODE_RE = re.compile(r"(\d{4})")


class AddressLookupError(RuntimeError):
    pass


class AddressLookupNotFound(AddressLookupError):
    pass


@dataclass(frozen=True)
class PostalCodePlace:
    name: str
    latitude: float | None
    longitude: float | None


@dataclass(frozen=True)
class PostalCodeLookupResult:
    postal_code: str
    province: str
    localities: list[PostalCodePlace]


@dataclass(frozen=True)
class GeocodedAddress:
    latitude: float
    longitude: float
    display_name: str | None


@dataclass(frozen=True)
class ReverseGeocodedAddress:
    street_name: str | None
    street_number: str | None
    display_name: str | None


def normalize_postal_code(value: str) -> str:
    compact = re.sub(r"\s+", "", value or "").upper()
    match = POSTAL_CODE_RE.search(compact)
    if match:
        return match.group(1)
    raise AddressLookupError("Ingresa un codigo postal argentino valido de 4 digitos.")


def _normalize_label(value: str) -> str:
    compact = " ".join((value or "").split())
    if not compact:
        return compact
    return compact.title()


def _parse_coordinate(value: object) -> float | None:
    try:
        if value in (None, ""):
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _compact_text(value: object) -> str:
    return " ".join(str(value or "").split())


def _headers() -> dict[str, str]:
    return {
        "User-Agent": settings.geocoding_user_agent,
        "Accept-Language": "es-AR,es;q=0.9",
    }


def lookup_postal_code(postal_code: str) -> PostalCodeLookupResult:
    normalized_postal_code = normalize_postal_code(postal_code)
    url = f"{settings.address_lookup_base_url.rstrip('/')}/AR/{normalized_postal_code}"

    try:
        with httpx.Client(timeout=settings.address_lookup_timeout_seconds, follow_redirects=True) as client:
            response = client.get(url, headers=_headers())
    except httpx.HTTPError as exc:
        raise AddressLookupError("No se pudo consultar el servicio de codigo postal en este momento.") from exc

    if response.status_code == 404:
        raise AddressLookupNotFound("No encontramos ese codigo postal en Argentina.")
    if response.status_code >= 400:
        raise AddressLookupError("El servicio de codigo postal no respondio correctamente.")

    payload = response.json()
    raw_places = payload.get("places", [])
    province = ""
    places: list[PostalCodePlace] = []
    seen: set[str] = set()

    for item in raw_places:
        name = _normalize_label(str(item.get("place name") or ""))
        state = _normalize_label(str(item.get("state") or item.get("state abbreviation") or ""))
        latitude = _parse_coordinate(item.get("latitude"))
        longitude = _parse_coordinate(item.get("longitude"))

        if not province and state:
            province = state
        if not name:
            continue

        key = name.casefold()
        if key in seen:
            continue
        seen.add(key)
        places.append(PostalCodePlace(name=name, latitude=latitude, longitude=longitude))

    geolocated_places = [place for place in places if place.latitude is not None and place.longitude is not None]
    if geolocated_places:
        places = geolocated_places

    if not province or not places:
        raise AddressLookupNotFound("No encontramos localidades utilizables para ese codigo postal.")

    return PostalCodeLookupResult(
        postal_code=normalized_postal_code,
        province=province,
        localities=places,
    )


def geocode_address(
    *,
    postal_code: str,
    province: str,
    locality: str,
    street_name: str,
    street_number: str,
) -> GeocodedAddress:
    normalized_postal_code = normalize_postal_code(postal_code)
    street_line = " ".join(part.strip() for part in [street_name, street_number] if part and part.strip())
    if not street_line:
        raise AddressLookupError("Ingresa calle y altura para ubicar la direccion.")

    search_url = f"{settings.geocoding_base_url.rstrip('/')}/search"
    params = {
        "street": street_line,
        "city": locality.strip(),
        "state": province.strip(),
        "postalcode": normalized_postal_code,
        "country": "Argentina",
        "countrycodes": "ar",
        "limit": 1,
        "format": "jsonv2",
        "addressdetails": 1,
    }

    try:
        with httpx.Client(timeout=settings.address_lookup_timeout_seconds, follow_redirects=True) as client:
            response = client.get(search_url, params=params, headers=_headers())
            results = response.json() if response.status_code < 400 else []
            if not results:
                fallback_params = {
                    "q": f"{street_line}, {locality.strip()}, {province.strip()}, {normalized_postal_code}, Argentina",
                    "countrycodes": "ar",
                    "limit": 1,
                    "format": "jsonv2",
                    "addressdetails": 1,
                }
                response = client.get(search_url, params=fallback_params, headers=_headers())
                results = response.json() if response.status_code < 400 else []
    except httpx.HTTPError as exc:
        raise AddressLookupError("No se pudo geolocalizar la direccion en este momento.") from exc

    if response.status_code == 429:
        raise AddressLookupError("El servicio de mapas esta momentaneamente saturado. Reintenta en unos segundos.")
    if response.status_code >= 400:
        raise AddressLookupError("El servicio de mapas no respondio correctamente.")
    if not results:
        raise AddressLookupNotFound("No pudimos ubicar esa direccion. Revisa CP, localidad, calle y altura.")

    location = results[0]
    latitude = _parse_coordinate(location.get("lat"))
    longitude = _parse_coordinate(location.get("lon"))
    if latitude is None or longitude is None:
        raise AddressLookupNotFound("La direccion encontrada no devolvio coordenadas validas.")

    return GeocodedAddress(
        latitude=latitude,
        longitude=longitude,
        display_name=location.get("display_name"),
    )


def reverse_geocode_coordinates(*, latitude: float, longitude: float) -> ReverseGeocodedAddress:
    reverse_url = f"{settings.geocoding_base_url.rstrip('/')}/reverse"
    params = {
        "lat": latitude,
        "lon": longitude,
        "format": "jsonv2",
        "addressdetails": 1,
        "zoom": 18,
    }

    try:
        with httpx.Client(timeout=settings.address_lookup_timeout_seconds, follow_redirects=True) as client:
            response = client.get(reverse_url, params=params, headers=_headers())
    except httpx.HTTPError as exc:
        raise AddressLookupError("No se pudo interpretar la ubicacion seleccionada en este momento.") from exc

    if response.status_code == 429:
        raise AddressLookupError("El servicio de mapas esta momentaneamente saturado. Reintenta en unos segundos.")
    if response.status_code >= 400:
        raise AddressLookupError("El servicio de mapas no respondio correctamente.")

    payload = response.json()
    address = payload.get("address") or {}
    street_name = next(
        (
            _compact_text(address.get(key))
            for key in ("road", "pedestrian", "footway", "street", "residential", "path", "cycleway")
            if _compact_text(address.get(key))
        ),
        "",
    )
    street_number = _compact_text(address.get("house_number"))

    if not street_name and not street_number:
        raise AddressLookupNotFound("No pudimos reconocer calle y altura en ese punto del mapa.")

    return ReverseGeocodedAddress(
        street_name=street_name or None,
        street_number=street_number or None,
        display_name=payload.get("display_name"),
    )
