import { Link } from "react-router-dom";
import { PlatformWordmark } from "../../../shared/components";
import type { LandingTheme } from "../utils/landingTheme";

export function Footer({ theme }: { theme: LandingTheme }) {
  return (
    <footer
      className="border p-6 transition-[background,border-color,box-shadow] duration-300"
      style={{
        backgroundImage: theme.softPanelGradient,
        borderColor: theme.accentBorder,
        boxShadow: `0 12px 28px -24px ${theme.accentShadow}`
      }}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <PlatformWordmark
            size="eyebrow"
            frameClassName="w-[8.5rem]"
            textClassName="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400"
          />
          <p className="mt-2 text-sm leading-7 text-zinc-600">
            A veces solo quieres resolverlo rapido. Para eso existe esta experiencia: menos busqueda, menos friccion y
            mas claridad para encontrar opciones cerca de ti.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="min-h-[44px] border bg-[#fffaf6] px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-[var(--landing-accent)]"
            style={{ borderColor: theme.accentBorderStrong }}
            to="/c"
          >
            Explorar comercios
          </Link>
          <Link
            className="min-h-[44px] border bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-[var(--landing-accent)]"
            style={{ borderColor: theme.accentBorder }}
            to="/registro"
          >
            Crear cuenta
          </Link>
        </div>
      </div>
    </footer>
  );
}
