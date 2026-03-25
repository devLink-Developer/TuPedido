import type { Category } from "../types";

export const DEFAULT_CATEGORY_COLOR = "#9E9E9E";
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

type CategoryPaletteSource =
  | Pick<Category, "color" | "color_light">
  | {
      color?: string | null;
      color_light?: string | null;
    }
  | null
  | undefined;

export function isHexColor(value: string | null | undefined) {
  return HEX_COLOR_RE.test((value ?? "").trim());
}

export function normalizeHexColor(value: string | null | undefined, fallback = DEFAULT_CATEGORY_COLOR) {
  const candidate = (value ?? "").trim();
  if (!candidate) return fallback;
  return HEX_COLOR_RE.test(candidate) ? candidate.toUpperCase() : fallback;
}

export function buildLightColor(color: string, ratio = 0.88) {
  const normalized = normalizeHexColor(color);
  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);
  const mix = (channel: number) => Math.round(channel + (255 - channel) * ratio);
  return `#${[mix(red), mix(green), mix(blue)].map((value) => value.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

export function resolveCategoryPalette(category: CategoryPaletteSource) {
  const color = normalizeHexColor(category?.color, DEFAULT_CATEGORY_COLOR);
  const colorLight = normalizeHexColor(category?.color_light, buildLightColor(color));
  return { color, colorLight };
}

export function hexToRgba(hex: string, alpha: number) {
  const normalized = normalizeHexColor(hex);
  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
