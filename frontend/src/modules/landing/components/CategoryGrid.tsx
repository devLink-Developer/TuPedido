import { Link } from "react-router-dom";
import { useCategoryStore } from "../../../shared/stores";
import { hexToRgba, resolveCategoryPalette } from "../../../shared/utils/categoryTheme";

function iconLabel(name: string, icon: string | null) {
  const trimmed = (icon ?? "").trim();
  if (trimmed) return trimmed.slice(0, 2).toUpperCase();
  return name.slice(0, 1).toUpperCase();
}

export function CategoryGrid() {
  const categories = useCategoryStore((state) => state.categories);
  const loading = useCategoryStore((state) => state.loading);
  const visibleCategories = categories.slice(0, 6);

  return (
    <section className="rounded-[32px] bg-white p-6 shadow-sm">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">Rubros destacados</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink">Encuentra lo que necesitas en minutos</h2>
        </div>
        <Link to="/c" className="text-sm font-semibold text-brand-600 transition hover:text-brand-700">
          Ver todos
        </Link>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visibleCategories.map((category) => {
          const palette = resolveCategoryPalette(category);
          return (
            <Link
              key={category.id}
              to={`/c?category=${category.slug}`}
              className="rounded-[24px] border px-4 py-4 transition hover:-translate-y-0.5"
              style={{
                backgroundColor: palette.colorLight,
                borderColor: hexToRgba(palette.color, 0.16),
                boxShadow: `0 18px 40px -32px ${hexToRgba(palette.color, 0.55)}`
              }}
            >
              <div
                className="flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-black"
                style={{ backgroundColor: hexToRgba(palette.color, 0.14), color: palette.color }}
              >
                {iconLabel(category.name, category.icon)}
              </div>
              <p className="mt-4 text-base font-bold" style={{ color: palette.color }}>
                {category.name}
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                {category.description || "Locales activos para resolver tu compra diaria sin vueltas."}
              </p>
            </Link>
          );
        })}

        {!visibleCategories.length && loading
          ? Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="h-[152px] animate-pulse rounded-[24px] bg-zinc-100" />
            ))
          : null}
      </div>
    </section>
  );
}
