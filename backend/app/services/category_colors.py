from __future__ import annotations

import re

DEFAULT_CATEGORY_COLOR = "#9E9E9E"
HEX_COLOR_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")


def normalize_hex_color(value: str | None, *, fallback: str | None = None) -> str | None:
    candidate = (value or "").strip()
    if not candidate:
        return fallback
    if not HEX_COLOR_RE.match(candidate):
        raise ValueError("Color must use HEX format #RRGGBB")
    return candidate.upper()


def _mix_channel(channel: int, target: int, ratio: float) -> int:
    return round(channel + (target - channel) * ratio)


def build_light_color(color: str, *, ratio: float = 0.88) -> str:
    normalized = normalize_hex_color(color, fallback=DEFAULT_CATEGORY_COLOR) or DEFAULT_CATEGORY_COLOR
    red = int(normalized[1:3], 16)
    green = int(normalized[3:5], 16)
    blue = int(normalized[5:7], 16)
    mixed = (
        _mix_channel(red, 255, ratio),
        _mix_channel(green, 255, ratio),
        _mix_channel(blue, 255, ratio),
    )
    return "#{:02X}{:02X}{:02X}".format(*mixed)


def resolve_category_palette(color: str | None, color_light: str | None) -> tuple[str, str]:
    resolved_color = normalize_hex_color(color, fallback=DEFAULT_CATEGORY_COLOR) or DEFAULT_CATEGORY_COLOR
    resolved_light = normalize_hex_color(color_light)
    return resolved_color, resolved_light or build_light_color(resolved_color)
