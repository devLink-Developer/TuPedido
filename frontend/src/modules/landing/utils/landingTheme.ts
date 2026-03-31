import type { Category } from "../../../shared/types";
import { hexToRgba, resolveCategoryPalette } from "../../../shared/utils/categoryTheme";

const DEFAULT_LANDING_COLOR = "#F97316";
const DEFAULT_LANDING_COLOR_LIGHT = "#FFF1E8";

type LandingCategorySource =
  | Pick<Category, "color" | "color_light">
  | null
  | undefined;

export type LandingTheme = {
  accent: string;
  accentLight: string;
  accentSoft: string;
  accentMuted: string;
  accentBorder: string;
  accentBorderStrong: string;
  accentGlow: string;
  accentShadow: string;
  accentShadowStrong: string;
  heroGradient: string;
  heroPanelGradient: string;
  softPanelGradient: string;
  commerceGradient: string;
  buttonGradient: string;
  textOnAccent: string;
  pageGlow: string;
};

export function buildLandingTheme(category: LandingCategorySource): LandingTheme {
  const palette = resolveCategoryPalette(
    category ?? {
      color: DEFAULT_LANDING_COLOR,
      color_light: DEFAULT_LANDING_COLOR_LIGHT
    }
  );

  return {
    accent: palette.color,
    accentLight: palette.colorLight,
    accentSoft: hexToRgba(palette.color, 0.08),
    accentMuted: hexToRgba(palette.color, 0.12),
    accentBorder: hexToRgba(palette.color, 0.18),
    accentBorderStrong: hexToRgba(palette.color, 0.34),
    accentGlow: hexToRgba(palette.color, 0.22),
    accentShadow: hexToRgba(palette.color, 0.18),
    accentShadowStrong: hexToRgba(palette.color, 0.3),
    heroGradient: `linear-gradient(135deg, ${hexToRgba(palette.color, 0.28)} 0%, #1d1614 18%, #281b18 52%, ${hexToRgba(palette.color, 0.22)} 100%)`,
    heroPanelGradient: `linear-gradient(180deg, ${hexToRgba(palette.color, 0.12)} 0%, rgba(255,255,255,0.08) 100%)`,
    softPanelGradient: `linear-gradient(180deg, ${hexToRgba(palette.color, 0.1)} 0%, rgba(255,255,255,0.98) 100%)`,
    commerceGradient: `linear-gradient(135deg, ${hexToRgba(palette.color, 0.28)} 0%, #221816 26%, #171210 100%)`,
    buttonGradient: `linear-gradient(135deg, ${palette.color} 0%, ${hexToRgba(palette.color, 0.82)} 100%)`,
    textOnAccent: "#FFFFFF",
    pageGlow: hexToRgba(palette.color, 0.16)
  };
}

