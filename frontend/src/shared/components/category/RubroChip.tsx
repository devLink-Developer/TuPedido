import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import { BadgePlus, Grid2X2, ShoppingBag, Store, UtensilsCrossed } from "lucide-react";
import { resolveCategoryPalette } from "../../utils/categoryTheme";

type RubroChipBaseProps = {
  label: string;
  color?: string | null;
  colorLight?: string | null;
  icon?: string | null;
  selected?: boolean;
  size?: "sm" | "md";
  className?: string;
};

type RubroChipButtonProps = RubroChipBaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "color"> & {
    as?: "button";
  };

type RubroChipSpanProps = RubroChipBaseProps &
  Omit<HTMLAttributes<HTMLSpanElement>, "children" | "color"> & {
    as: "span";
  };

function joinClasses(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function normalizeIconSource(label: string, icon: string | null | undefined) {
  return `${icon ?? ""} ${label}`
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function resolveRubroIcon(label: string, icon?: string | null): LucideIcon {
  const value = normalizeIconSource(label, icon);

  if (/farm|pharma|botica|salud|medic|remedio|badgeplus/.test(value)) return BadgePlus;
  if (/almacen|mercado|market|despensa|kiosco|tienda|store/.test(value)) return Store;
  if (/comida|food|rest|rotiseria|pizza|burger|sushi|cafe|utensil/.test(value)) return UtensilsCrossed;
  if (/bebida|drink|bar|cerve|vino|licor|gaseosa|shoppingbag/.test(value)) return ShoppingBag;
  if (/mas|todos|todo|grid|rubro|categoria/.test(value)) return Grid2X2;

  return Grid2X2;
}

function buildChipStyle({
  color,
  colorLight,
  style
}: {
  color?: string | null;
  colorLight?: string | null;
  style?: CSSProperties;
}) {
  const palette = resolveCategoryPalette({ color, color_light: colorLight ?? null });
  return {
    "--rubro-color": palette.color,
    "--rubro-color-light": palette.colorLight,
    ...style
  } as CSSProperties;
}

function ChipContent({
  label,
  icon
}: {
  label: string;
  icon?: string | null;
}) {
  const Icon = resolveRubroIcon(label, icon);

  return (
    <>
      <Icon aria-hidden="true" strokeWidth={2.1} />
      <span>{label}</span>
    </>
  );
}

export function RubroChip(props: RubroChipButtonProps | RubroChipSpanProps) {
  const { as = "button", label, color, colorLight, icon, selected = false, size = "md", className = "" } = props;
  const sizeClass = size === "sm" ? "kp-category-pill-compact" : "";

  if (as === "span") {
    const {
      as: _as,
      style,
      label: _label,
      color: _color,
      colorLight: _colorLight,
      icon: _icon,
      selected: _selected,
      size: _size,
      className: _className,
      ...spanProps
    } = props as RubroChipSpanProps;
    return (
      <span
        {...spanProps}
        className={joinClasses(
          "kp-category-pill kp-category-pill-static",
          sizeClass,
          selected && "kp-category-pill-active",
          className
        )}
        style={buildChipStyle({ color, colorLight, style })}
      >
        <ChipContent label={label} icon={icon} />
      </span>
    );
  }

  const {
    as: _as,
    style,
    type,
    label: _label,
    color: _color,
    colorLight: _colorLight,
    icon: _icon,
    selected: _selected,
    size: _size,
    className: _className,
    ...buttonProps
  } = props as RubroChipButtonProps;
  return (
    <button
      {...buttonProps}
      type={type ?? "button"}
      aria-pressed={selected}
      className={joinClasses(
        "kp-category-pill disabled:cursor-not-allowed disabled:opacity-60",
        sizeClass,
        selected && "kp-category-pill-active",
        className
      )}
      style={buildChipStyle({ color, colorLight, style })}
    >
      <ChipContent label={label} icon={icon} />
    </button>
  );
}
