from __future__ import annotations

import base64
import hashlib
import json
import re
from datetime import datetime, timedelta

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


def slugify(value: str) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower())
    normalized = re.sub(r"-{2,}", "-", normalized).strip("-")
    return normalized or "item"


SENSITIVE_VALUE_PREFIX = "v2"


def _build_legacy_key() -> bytes:
    return hashlib.sha256(settings.jwt_secret.encode("utf-8")).digest()


def _derive_fernet_key(secret: str) -> bytes:
    return base64.urlsafe_b64encode(hashlib.sha256(secret.encode("utf-8")).digest())


def _configured_sensitive_keys() -> dict[str, str]:
    raw_value = (settings.sensitive_data_keys or "").strip()
    if not raw_value:
        return {"default": settings.jwt_secret}

    try:
        parsed = json.loads(raw_value)
    except json.JSONDecodeError:
        parsed = None

    keys: dict[str, str] = {}
    if isinstance(parsed, dict):
        keys = {
            str(key).strip(): str(value)
            for key, value in parsed.items()
            if str(key).strip() and str(value)
        }
    else:
        for item in raw_value.split(","):
            key_id, separator, secret = item.partition(":")
            if not separator:
                key_id, separator, secret = item.partition("=")
            key_id = key_id.strip()
            secret = secret.strip()
            if key_id and secret:
                keys[key_id] = secret

    return keys or {"default": settings.jwt_secret}


def _active_sensitive_key_id(keys: dict[str, str]) -> str:
    configured_id = (settings.active_key_id or "").strip()
    if configured_id and configured_id in keys:
        return configured_id
    if "default" in keys:
        return "default"
    return sorted(keys)[0]


def _legacy_encrypt(value: str) -> str:
    payload = value.encode("utf-8")
    key = _build_legacy_key()
    encrypted = bytes(byte ^ key[index % len(key)] for index, byte in enumerate(payload))
    return base64.urlsafe_b64encode(encrypted).decode("utf-8")


def _legacy_decrypt(value: str) -> str:
    payload = base64.urlsafe_b64decode(value.encode("utf-8"))
    key = _build_legacy_key()
    decrypted = bytes(byte ^ key[index % len(key)] for index, byte in enumerate(payload))
    return decrypted.decode("utf-8")


def encrypt_sensitive_value(value: str) -> str:
    if not value:
        return ""

    keys = _configured_sensitive_keys()
    key_id = _active_sensitive_key_id(keys)
    token = Fernet(_derive_fernet_key(keys[key_id])).encrypt(value.encode("utf-8")).decode("utf-8")
    return f"{SENSITIVE_VALUE_PREFIX}:{key_id}:{token}"


def decrypt_sensitive_value(value: str) -> str:
    if not value:
        return ""

    if value.startswith(f"{SENSITIVE_VALUE_PREFIX}:"):
        try:
            _, key_id, token = value.split(":", 2)
        except ValueError as exc:
            raise ValueError("Invalid sensitive value format") from exc
        keys = _configured_sensitive_keys()
        secret = keys.get(key_id)
        if not secret:
            raise ValueError("Sensitive value key is not available")
        try:
            return Fernet(_derive_fernet_key(secret)).decrypt(token.encode("utf-8")).decode("utf-8")
        except InvalidToken as exc:
            raise ValueError("Sensitive value could not be decrypted") from exc

    return _legacy_decrypt(value)


def mask_secret(value: str | None, visible: int = 4) -> str | None:
    if not value:
        return None
    if len(value) <= visible:
        return "*" * len(value)
    return f"{'*' * (len(value) - visible)}{value[-visible:]}"


def is_store_open(store: object, now: datetime | None = None) -> bool:
    current = now or datetime.now()
    status = getattr(store, "status", "")
    if status != "approved":
        return False
    if not getattr(store, "accepting_orders", False):
        return False

    hours = list(getattr(store, "hours", []) or [])
    if not hours:
        return True

    current_day = (current.weekday() + 1) % 7
    current_time = current.time()
    matching_hours = [hour for hour in hours if hour.day_of_week == current_day]
    if not matching_hours:
        return False

    for hour in matching_hours:
        if hour.is_closed:
            continue
        if hour.opens_at is None or hour.closes_at is None:
            continue
        if hour.opens_at <= current_time <= hour.closes_at:
            return True
    return False


def next_store_opening_at(store: object, now: datetime | None = None) -> datetime | None:
    current = now or datetime.now()
    status = getattr(store, "status", "")
    if status != "approved":
        return None
    if not getattr(store, "accepting_orders", False):
        return None

    hours = [
        hour
        for hour in list(getattr(store, "hours", []) or [])
        if not hour.is_closed and hour.opens_at is not None and hour.closes_at is not None
    ]
    if not hours:
        return current
    if is_store_open(store, current):
        return current

    current_day = (current.weekday() + 1) % 7
    candidates: list[datetime] = []
    for offset in range(8):
        target_day = (current_day + offset) % 7
        target_date = (current + timedelta(days=offset)).date()
        for hour in hours:
            if hour.day_of_week != target_day:
                continue
            candidate = datetime.combine(target_date, hour.opens_at)
            if current.tzinfo is not None:
                candidate = candidate.replace(tzinfo=current.tzinfo)
            if candidate <= current:
                continue
            candidates.append(candidate)

    return min(candidates, default=None)


def build_address_text(address: object) -> str:
    street = getattr(address, "street", "")
    details = getattr(address, "details", "")
    return ", ".join(part for part in [street, details] if part)
