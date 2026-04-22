import { Link } from "react-router-dom";
import { PlatformWordmark } from "../../../shared/components";
import type { LandingTheme } from "../utils/landingTheme";

export function CTAComercio({ theme }: { theme: LandingTheme }) {
  return (
    <section
      className="border p-6 text-white transition-[background,border-color,box-shadow] duration-300"
      style={{
        backgroundImage: theme.commerceGradient,
        borderColor: "rgba(255,255,255,0.08)",
        boxShadow: `0 18px 38px -30px ${theme.accentShadowStrong}`
      }}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#e7cfc0]">Para hoy</p>
          <h2 className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 font-display text-3xl font-bold tracking-tight">
            <span>Busca cerca, elige tranquilo y resuelve en minutos con</span>
            <PlatformWordmark
              size="title"
              frameClassName="w-[12.5rem] sm:w-[15rem]"
              textClassName="text-3xl"
            />
          </h2>
          <p className="mt-3 text-sm leading-7 text-white/72">
            Ya sea para comer, reponer algo de casa o salir de un apuro, la idea es la misma: encontrar opciones
            reales cerca de ti y avanzar rapido sin sentir que pedir es otra tarea mas.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm text-white/78">
            <span className="border border-white/10 bg-white/[0.03] px-3 py-2">Comercios cercanos</span>
            <span className="border border-white/10 bg-white/[0.03] px-3 py-2">Envio o retiro</span>
            <span className="border border-white/10 bg-white/[0.03] px-3 py-2">Busqueda simple</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            className="inline-flex min-h-[48px] items-center justify-center border px-5 py-3 text-sm font-semibold text-white transition hover:opacity-92"
            style={{
              backgroundImage: theme.buttonGradient,
              borderColor: theme.accentBorderStrong
            }}
            to="/c"
          >
            Ver que hay cerca
          </Link>
          <Link
            className="inline-flex min-h-[48px] items-center justify-center border border-white/14 bg-transparent px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.04]"
            to="/registro"
          >
            Crear cuenta
          </Link>
        </div>
      </div>
    </section>
  );
}
