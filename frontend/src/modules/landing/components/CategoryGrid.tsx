import { Link } from "react-router-dom";
import type { Category } from "../../../shared/types";
import { hexToRgba, resolveCategoryPalette } from "../../../shared/utils/categoryTheme";
import type { LandingTheme } from "../utils/landingTheme";

function iconLabel(name: string, icon: string | null) {
  const trimmed = (icon ?? "").trim();
  if (trimmed) return trimmed.slice(0, 2).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function CategoryGrid({
  categories,
  loading,
  selectedCategory,
  selectedCategorySlug,
  onSelectCategory,
  theme
}: {
  categories: Category[];
  loading: boolean;
  selectedCategory: Category | null;
  selectedCategorySlug: string | null;
  onSelectCategory: (slug: string) => void;
  theme: LandingTheme;
}) {
  return (
    <section
      className="rounded-[32px] border p-6 shadow-sm transition-[background,border-color,box-shadow] duration-300"
      style={{
        backgroundImage: theme.softPanelGradient,
        borderColor: theme.accentBorder,
        boxShadow: `0 22px 44px -34px ${theme.accentShadow}`
      }}
    >
      <div className="grid gap-5 lg:grid-cols-[0.88fr_1.12fr] lg:items-start">
        <div
          className="rounded-[28px] border p-5 transition-[background,border-color] duration-300"
          style={{
            backgroundColor: selectedCategory ? theme.accentMuted : "rgba(255,255,255,0.84)",
            borderColor: selectedCategory ? theme.accentBorderStrong : "rgba(0,0,0,0.06)"
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">Rubros destacados</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink">
            {selectedCategory ? selectedCategory.name : "Elige un rubro y cambia el ritmo visual de la pagina"}
          </h2>
          <p className="mt-3 text-sm leading-7 text-zinc-600">
            {selectedCategory
              ? selectedCategory.description || `Ya tienes activo el contexto de ${selectedCategory.name.toLowerCase()}. Desde aqui puedes entrar directo a ese rubro en el catalogo.`
              : "Cada rubro tiene su propia paleta. Al seleccionarlo, la landing toma ese color para que el contexto cambie de verdad."}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {selectedCategory ? (
              <>
                <Link
                  to={`/c?category=${selectedCategory.slug}`}
                  className="inline-flex rounded-full px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
                  style={{
                    backgroundImage: theme.buttonGradient,
                    boxShadow: `0 18px 30px -20px ${theme.accentShadowStrong}`
                  }}
                >
                  Explorar {selectedCategory.name}
                </Link>
                <button
                  type="button"
                  onClick={() => onSelectCategory(selectedCategory.slug)}
                  className="rounded-full border px-4 py-2.5 text-sm font-semibold transition"
                  style={{ borderColor: theme.accentBorderStrong, color: theme.accent }}
                >
                  Quitar seleccion
                </button>
              </>
            ) : (
              <span
                className="inline-flex rounded-full border px-4 py-2.5 text-sm font-semibold"
                style={{ borderColor: theme.accentBorder, backgroundColor: theme.accentSoft, color: theme.accent }}
              >
                Toca un rubro para verlo en contexto
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const palette = resolveCategoryPalette(category);
            const selected = selectedCategorySlug === category.slug;

            return (
              <button
                key={category.id}
                type="button"
                onClick={() => onSelectCategory(category.slug)}
                className="group relative overflow-hidden rounded-[26px] border px-4 py-4 text-left transition duration-200 hover:-translate-y-0.5"
                style={{
                  backgroundColor: selected ? palette.colorLight : "#FFFFFF",
                  borderColor: selected ? hexToRgba(palette.color, 0.34) : hexToRgba(palette.color, 0.16),
                  boxShadow: selected
                    ? `0 24px 46px -34px ${hexToRgba(palette.color, 0.48)}`
                    : `0 18px 36px -34px ${hexToRgba(palette.color, 0.34)}`
                }}
              >
                <div
                  className="absolute inset-x-0 top-0 h-1 transition-opacity duration-200"
                  style={{ backgroundColor: palette.color, opacity: selected ? 1 : 0.75 }}
                />
                <div className="flex items-start justify-between gap-3">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-[18px] text-sm font-black"
                    style={{
                      backgroundColor: hexToRgba(palette.color, selected ? 0.2 : 0.14),
                      color: palette.color
                    }}
                  >
                    {iconLabel(category.name, category.icon)}
                  </div>
                  <span
                    className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
                    style={{
                      backgroundColor: selected ? palette.color : hexToRgba(palette.color, 0.1),
                      color: selected ? "#FFFFFF" : palette.color
                    }}
                  >
                    {selected ? "Activo" : "Ver"}
                  </span>
                </div>
                <p className="mt-4 text-base font-bold" style={{ color: palette.color }}>
                  {category.name}
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  {category.description || "Locales activos para resolver tu compra diaria sin vueltas."}
                </p>
              </button>
            );
          })}

          {!categories.length && loading
            ? Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="h-[172px] animate-pulse rounded-[24px] bg-zinc-100" />
              ))
            : null}
        </div>
      </div>
    </section>
  );
}

