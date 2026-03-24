from __future__ import annotations

import base64
import hashlib
import re
from datetime import datetime, timedelta

from app.core.config import settings


def slugify(value: str) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower())
    normalized = re.sub(r"-{2,}", "-", normalized).strip("-")
    return normalized or "item"


def _build_key() -> bytes:
    return hashlib.sha256(settings.jwt_secret.encode("utf-8")).digest()


def encrypt_sensitive_value(value: str) -> str:
    if not value:
        return ""

    payload = value.encode("utf-8")
    key = _build_key()
    encrypted = bytes(byte ^ key[index % len(key)] for index, byte in enumerate(payload))
    return base64.urlsafe_b64encode(encrypted).decode("utf-8")


def decrypt_sensitive_value(value: str) -> str:
    if not value:
        return ""

    payload = base64.urlsafe_b64decode(value.encode("utf-8"))
    key = _build_key()
    decrypted = bytes(byte ^ key[index % len(key)] for index, byte in enumerate(payload))
    return decrypted.decode("utf-8")


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
