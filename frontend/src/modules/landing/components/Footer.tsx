import { Link } from "react-router-dom";
import { PlatformWordmark } from "../../../shared/components";
import type { Category } from "../../../shared/types";
import type { LandingTheme } from "../utils/landingTheme";

export function Footer({
  selectedCategory,
  theme
}: {
  selectedCategory: Category | null;
  theme: LandingTheme;
}) {
  return (
    <footer
      className="rounded-[32px] border p-6 shadow-sm transition-[background,border-color,box-shadow] duration-300"
      style={{
        backgroundImage: theme.softPanelGradient,
        borderColor: theme.accentBorder,
        boxShadow: `0 20px 40px -36px ${theme.accentShadow}`
      }}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <PlatformWordmark
            size="eyebrow"
            frameClassName="w-[8.5rem]"
            textClassName="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400"
          />
          <p className="mt-2 text-sm text-zinc-600">
            {selectedCategory
              ? `Ahora mismo estas navegando con el contexto visual de ${selectedCategory.name.toLowerCase()}.`
              : "Soluciones para clientes y comercios en una misma plataforma."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="rounded-full border px-4 py-2 text-sm font-semibold text-zinc-700 transition"
            style={{ borderColor: theme.accentBorderStrong, backgroundColor: selectedCategory ? theme.accentSoft : "#F8FAFC" }}
            to={selectedCategory ? `/c?category=${selectedCategory.slug}` : "/c"}
          >
            {selectedCategory ? `Ver ${selectedCategory.name}` : "Comprar"}
          </Link>
          <Link
            className="rounded-full border px-4 py-2 text-sm font-semibold text-zinc-700 transition"
            style={{ borderColor: theme.accentBorder, backgroundColor: "#FFFFFF" }}
            to="/registro-comercio"
          >
            Sumar comercio
          </Link>
        </div>
      </div>
    </footer>
  );
}

