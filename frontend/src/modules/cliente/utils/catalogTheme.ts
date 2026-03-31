import type { Category } from "../../../shared/types";
import { hexToRgba, resolveCategoryPalette } from "../../../shared/utils/categoryTheme";

const DEFAULT_CATALOG_COLOR = "#FF6A1A";
const DEFAULT_CATALOG_COLOR_LIGHT = "#FFF2E8";

type CatalogCategorySource =
  | Pick<Category, "color" | "color_light">
  | null
  | undefined;

export type CatalogTheme = {
  accent: string;
  accentLight: string;
  accentSoft: string;
  accentMuted: string;
  accentBorder: string;
  accentBorderStrong: string;
  accentShadow: string;
  accentShadowStrong: string;
  accentGlow: string;
  pageGlow: string;
  bannerFrame: string;
  filterPanel: string;
  chipPanel: string;
  cardSurface: string;
  textTint: string;
};

export function buildCatalogTheme(category: CatalogCategorySource): CatalogTheme {
  const palette = resolveCategoryPalette(
    category ?? {
      color: DEFAULT_CATALOG_COLOR,
      color_light: DEFAULT_CATALOG_COLOR_LIGHT
    }
  );

  return {
    accent: palette.color,
    accentLight: palette.colorLight,
    accentSoft: hexToRgba(palette.color, 0.08),
    accentMuted: hexToRgba(palette.color, 0.14),
    accentBorder: hexToRgba(palette.color, 0.18),
    accentBorderStrong: hexToRgba(palette.color, 0.3),
    accentShadow: hexToRgba(palette.color, 0.18),
    accentShadowStrong: hexToRgba(palette.color, 0.28),
    accentGlow: hexToRgba(palette.color, 0.22),
    pageGlow: hexToRgba(palette.color, 0.16),
    bannerFrame: `linear-gradient(180deg, rgba(255,255,255,0.92) 0%, ${hexToRgba(palette.color, 0.08)} 100%)`,
    filterPanel: `linear-gradient(180deg, rgba(255,255,255,0.98) 0%, ${hexToRgba(palette.color, 0.06)} 100%)`,
    chipPanel: `linear-gradient(135deg, ${hexToRgba(palette.color, 0.08)} 0%, rgba(255,255,255,0.97) 58%, rgba(255,255,255,0.92) 100%)`,
    cardSurface: `linear-gradient(180deg, rgba(255,255,255,0.98) 0%, ${hexToRgba(palette.color, 0.045)} 100%)`,
    textTint: hexToRgba(palette.color, 0.82)
  };
}
