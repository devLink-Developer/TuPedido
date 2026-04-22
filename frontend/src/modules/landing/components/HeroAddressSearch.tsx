import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PlatformWordmark } from "../../../shared/components";
import type { LandingTheme } from "../utils/landingTheme";

const heroMoments = [
  "Cuando falta algo en casa y no quieres cortar tu dia.",
  "Cuando toca resolver la comida sin abrir cinco apps distintas.",
  "Cuando prefieres retiro o envio segun como venga hoy."
];

export function HeroAddressSearch({ theme }: { theme: LandingTheme }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  return (
    <section
      className="overflow-hidden border px-5 py-7 text-white transition-[background,border-color,box-shadow] duration-300 sm:px-6 md:px-8 md:py-10"
      style={{
        backgroundImage: theme.heroGradient,
        borderColor: "rgba(255,255,255,0.08)",
        boxShadow: `0 18px 38px -30px ${theme.accentShadowStrong}`
      }}
    >
      <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-start">
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="min-w-0">
              <PlatformWordmark
                size="title"
                frameClassName="h-8 w-[10.5rem] sm:h-9 sm:w-[12rem]"
                imageClassName="opacity-95"
                textClassName="text-base font-bold uppercase tracking-[0.22em] text-[#f0d9ca]"
              />
            </div>
            <div
              className="inline-flex items-center border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.22em]"
              style={{
                borderColor: theme.accentBorderStrong,
                backgroundColor: "rgba(255,255,255,0.03)",
                color: theme.textOnAccent
              }}
            >
              Hecho para tu dia a dia
            </div>
            <h1 className="max-w-3xl font-display text-[2rem] font-bold leading-[1.02] tracking-[-0.02em] sm:text-4xl md:text-[3.35rem]">
              Resolver la cena, una compra urgente o eso que falto deberia sentirse simple.
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-white/72 md:text-base">
              Encuentra comercios cercanos, compara en pocos segundos y elige la opcion que mejor encaja con tu
              momento. Menos vueltas, mas claridad y un pedido resuelto sin friccion.
            </p>
          </div>
          <form
            className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              const params = new URLSearchParams();
              const query = search.trim();
              if (query) params.set("search", query);
              const nextSearch = params.toString();
              navigate(nextSearch ? `/c?${nextSearch}` : "/c");
            }}
          >
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar comida, farmacia, almacen o comercio"
              className="min-h-[50px] border border-white/12 bg-white px-4 py-3 text-ink outline-none placeholder:text-zinc-400 focus:border-[var(--landing-accent)]"
            />
            <button
              type="submit"
              className="inline-flex min-h-[50px] items-center justify-center border px-5 py-3 text-sm font-semibold text-white transition hover:opacity-92"
              style={{
                backgroundImage: theme.buttonGradient,
                borderColor: theme.accentBorderStrong
              }}
            >
              Ver que hay cerca
            </button>
          </form>
        </div>

        <aside
          className="border p-4 transition-[background,border-color] duration-300 sm:p-5"
          style={{
            borderColor: "rgba(255,255,255,0.1)",
            backgroundImage: theme.heroPanelGradient
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#e7cfc0]">Pensado para momentos reales</p>
          <div className="mt-4 grid gap-3 text-sm leading-7 text-white/74">
            {heroMoments.map((moment) => (
              <div key={moment} className="border border-white/8 bg-white/[0.04] px-4 py-4">
                {moment}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
