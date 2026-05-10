export const colors = {
  primary: "#EA580C",
  primaryDark: "#9A3412",
  primarySoft: "#FFF7ED",
  secondary: "#F97316",
  accent: "#2563EB",
  background: "#FFF7ED",
  backgroundStrong: "#FFEDD5",
  surface: "#FFFFFF",
  surfaceAlt: "#FDF4F0",
  border: "#FCEAE1",
  borderStrong: "#FED7AA",
  text: "#0F172A",
  mutedText: "#64748B",
  subtleText: "#94A3B8",
  success: "#047857",
  successSoft: "#DCFCE7",
  warning: "#B45309",
  warningSoft: "#FEF3C7",
  danger: "#DC2626",
  dangerSoft: "#FEE2E2",
  disabled: "#CBD5E1"
};

export const opacity = {
  pressed: 0.78,
  disabled: 0.58
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32
};

export const touchTarget = {
  min: 48,
  comfortable: 52
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999
};

export const typography = {
  button: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800" as const
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700" as const
  },
  body: {
    fontSize: 14,
    lineHeight: 20
  },
  caption: {
    fontSize: 12,
    lineHeight: 16
  }
};

export const shadow = {
  soft: {
    shadowColor: "#9A3412",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2
  },
  medium: {
    shadowColor: "#9A3412",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 4
  },
  primary: {
    shadowColor: "#C2410C",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 5
  }
};
