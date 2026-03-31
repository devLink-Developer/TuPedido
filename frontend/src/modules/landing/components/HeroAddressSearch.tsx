import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PlatformWordmark } from "../../../shared/components";
import type { Category } from "../../../shared/types";
import type { LandingTheme } from "../utils/landingTheme";

export function HeroAddressSearch({
  selectedCategory,
  theme
}: {
  selectedCategory: Category | null;
  theme: LandingTheme;
}) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  return (
    <section
      className="ambient-grid overflow-hidden rounded-[40px] px-5 py-7 text-white shadow-lift transition-[background,box-shadow,border-color] duration-300 sm:px-6 md:px-8 md:py-10"
      style={{
        backgroundImage: theme.heroGradient,
        boxShadow: `0 28px 60px -42px ${theme.accentShadowStrong}`
      }}
    >
      <div className="absolute -right-10 top-6 h-36 w-36 rounded-full blur-3xl orb-float" style={{ backgroundColor: theme.accentGlow }} />
      <div className="relative grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <div className="space-y-3">
            <div className="min-w-0">
              <PlatformWordmark
                size="title"
                frameClassName="h-8 w-[10.5rem] sm:h-9 sm:w-[12rem]"
                imageClassName="opacity-95"
                textClassName="text-base font-bold uppercase tracking-[0.22em] text-[#ffd2bd]"
              />
            </div>
            {selectedCategory ? (
              <div
                className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.22em]"
                style={{
                  borderColor: theme.accentBorderStrong,
                  backgroundColor: theme.accentMuted,
                  color: theme.textOnAccent
                }}
              >
                <span
                  className="flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[10px] font-black"
                  style={{ backgroundColor: theme.accent, color: theme.textOnAccent }}
                >
                  {(selectedCategory.icon?.trim() || selectedCategory.name).slice(0, 2).toUpperCase()}
                </span>
                <span>{selectedCategory.name}</span>
              </div>
            ) : null}
            <h1 className="max-w-3xl font-display text-[2rem] font-bold leading-[1.05] sm:text-4xl md:text-5xl">
              {selectedCategory ? `Todo listo para pedir en ${selectedCategory.name.toLowerCase()}.` : "Todo lo que necesitas en un solo lugar."}
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-white/72 md:text-base md:leading-7">
              {selectedCategory
                ? selectedCategory.description || `Explora comercios de ${selectedCategory.name.toLowerCase()}, entra al local que mas te cierre y resuelve tu compra sin dar vueltas.`
                : "Descubre comercios cercanos, organiza tu compra y sigue cada pedido con una experiencia simple y clara."}
            </p>
          </div>
          <form
            className="grid gap-3 sm:grid-cols-[1fr_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              const params = new URLSearchParams();
              const query = search.trim();
              if (query) params.set("search", query);
              if (selectedCategory?.slug) params.set("category", selectedCategory.slug);
              const nextSearch = params.toString();
              navigate(nextSearch ? `/c?${nextSearch}` : "/c");
            }}
          >
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={selectedCategory ? `Buscar en ${selectedCategory.name.toLowerCase()}` : "Buscar comercio, rubro o direccion"}
              className="w-full rounded-[24px] border border-white/10 bg-white/10 px-4 py-3 text-white outline-none backdrop-blur placeholder:text-white/45"
            />
            <button
              type="submit"
              className="rounded-full px-5 py-3 text-sm font-semibold text-white shadow-float transition hover:opacity-95"
              style={{
                backgroundImage: theme.buttonGradient,
                boxShadow: `0 20px 36px -24px ${theme.accentShadowStrong}`
              }}
            >
              {selectedCategory ? `Explorar ${selectedCategory.name}` : "Explorar comercios"}
            </button>
          </form>
        </div>
        <div
          className="rounded-[32px] border p-4 backdrop-blur-md transition-[background,border-color] duration-300 sm:p-5"
          style={{
            borderColor: theme.accentBorder,
            backgroundImage: theme.heroPanelGradient
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#ffd2bd]/80">
            {selectedCategory ? "Por que este rubro destaca" : "Por que pedir aqui"}
          </p>
          <div className="mt-4 grid gap-3 text-sm leading-6 text-white/74 sm:leading-7">
            <div className="rounded-[22px] bg-white/10 px-4 py-4">
              {selectedCategory
                ? `Encuentra locales de ${selectedCategory.name.toLowerCase()} con una entrada mucho mas clara.`
                : "Comercios, farmacias y locales cerca de vos."}
            </div>
            <div className="rounded-[22px] bg-white/10 px-4 py-4">
              {selectedCategory
                ? "El color del rubro te va guiando para que identifiques rapido donde estas navegando."
                : "Pedidos faciles de seguir desde la compra hasta la entrega."}
            </div>
            <div className="rounded-[22px] bg-white/10 px-4 py-4">
              {selectedCategory
                ? "Un toque y ya puedes saltar directo al catalogo filtrado por ese rubro."
                : "Montos claros y confirmados antes de finalizar tu pedido."}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
