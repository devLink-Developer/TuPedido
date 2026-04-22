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
    accentSoft: hexToRgba(palette.color, 0.05),
    accentMuted: hexToRgba(palette.color, 0.08),
    accentBorder: hexToRgba(palette.color, 0.18),
    accentBorderStrong: hexToRgba(palette.color, 0.28),
    accentGlow: hexToRgba(palette.color, 0.06),
    accentShadow: "rgba(24, 19, 18, 0.12)",
    accentShadowStrong: "rgba(24, 19, 18, 0.16)",
    heroGradient: "linear-gradient(180deg, #2a2320 0%, #1c1714 100%)",
    heroPanelGradient: "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.03) 100%)",
    softPanelGradient: "linear-gradient(180deg, rgba(255,255,255,0.995) 0%, rgba(251,248,244,0.99) 100%)",
    commerceGradient: "linear-gradient(180deg, #231c19 0%, #181311 100%)",
    buttonGradient: `linear-gradient(180deg, ${palette.color} 0%, ${palette.color} 100%)`,
    textOnAccent: "#FFFFFF",
    pageGlow: "rgba(24, 19, 18, 0.03)"
  };
}
