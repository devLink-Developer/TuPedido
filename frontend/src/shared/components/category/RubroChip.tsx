import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes } from "react";
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

function resolveIconToken(label: string, icon: string | null | undefined) {
  const trimmed = (icon ?? "").trim();
  if (trimmed) return trimmed.length <= 2 ? trimmed : trimmed.slice(0, 2);
  return (label.trim().slice(0, 1) || "R").toUpperCase();
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
  icon,
  selected,
  size
}: {
  label: string;
  icon?: string | null;
  selected: boolean;
  size: "sm" | "md";
}) {
  return (
    <>
      <span
        aria-hidden="true"
        className={joinClasses(
          "inline-flex items-center justify-center rounded-full px-1 font-black leading-none transition-colors",
          size === "sm" ? "h-5 min-w-5 text-[9px]" : "h-5 min-w-5 text-[10px]",
          selected ? "bg-white/15 text-white" : "bg-[var(--rubro-color-light)] text-[var(--rubro-color)]"
        )}
      >
        {resolveIconToken(label, icon)}
      </span>
      <span>{label}</span>
    </>
  );
}

export function RubroChip(props: RubroChipButtonProps | RubroChipSpanProps) {
  const { as = "button", label, color, colorLight, icon, selected = false, size = "md", className = "" } = props;
  const sizeClass = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";

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
          "inline-flex items-center gap-2 rounded-full border-solid font-semibold leading-none",
          sizeClass,
          selected ? "border-0 bg-[var(--rubro-color)] text-white" : "border bg-transparent text-[var(--rubro-color)] border-[var(--rubro-color)]",
          className
        )}
        style={buildChipStyle({ color, colorLight, style })}
      >
        <ChipContent label={label} icon={icon} selected={selected} size={size} />
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
        "inline-flex items-center gap-2 rounded-full border-solid font-semibold leading-none transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rubro-color)] disabled:cursor-not-allowed disabled:opacity-60",
        sizeClass,
        selected ? "border-0 bg-[var(--rubro-color)] text-white" : "border bg-transparent text-[var(--rubro-color)] border-[var(--rubro-color)]",
        selected ? "hover:opacity-90" : "hover:bg-[var(--rubro-color-light)] hover:text-[var(--rubro-color)]",
        className
      )}
      style={buildChipStyle({ color, colorLight, style })}
    >
      <ChipContent label={label} icon={icon} selected={selected} size={size} />
    </button>
  );
}
