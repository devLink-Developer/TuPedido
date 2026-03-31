import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PlatformWordmark } from "../../../shared/components";
import { Button } from "../../../shared/ui/Button";

export function HeroAddressSearch() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  return (
    <section className="ambient-grid overflow-hidden rounded-[40px] bg-[linear-gradient(135deg,#1d1614_0%,#281b18_45%,#3a221a_100%)] px-5 py-7 text-white shadow-lift sm:px-6 md:px-8 md:py-10">
      <div className="absolute -right-10 top-6 h-36 w-36 rounded-full bg-brand-400/20 blur-3xl orb-float" />
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
            <h1 className="max-w-3xl font-display text-[2rem] font-bold leading-[1.05] sm:text-4xl md:text-5xl">
              Todo lo que necesitas en un solo lugar.
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-white/72 md:text-base md:leading-7">
              Descubre comercios cercanos, organiza tu compra y sigue cada pedido con una experiencia simple y clara.
            </p>
          </div>
          <form
            className="grid gap-3 sm:grid-cols-[1fr_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              const query = search.trim();
              navigate(query ? `/c?search=${encodeURIComponent(query)}` : "/c");
            }}
          >
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar comercio, rubro o direccion"
              className="w-full rounded-[24px] border border-white/10 bg-white/10 px-4 py-3 text-white outline-none backdrop-blur placeholder:text-white/45"
            />
            <Button type="submit">Explorar comercios</Button>
          </form>
        </div>
        <div className="rounded-[32px] border border-white/10 bg-white/10 p-4 backdrop-blur-md sm:p-5">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold uppercase tracking-[0.24em] text-[#ffd2bd]/80">
            <span>Por que elegir</span>
            <PlatformWordmark
              size="eyebrow"
              frameClassName="w-[8.5rem]"
              imageClassName="opacity-95"
              textClassName="text-xs font-semibold uppercase tracking-[0.24em] text-[#ffd2bd]/80"
            />
          </p>
          <div className="mt-4 grid gap-3 text-sm leading-6 text-white/74 sm:leading-7">
            <div className="rounded-[22px] bg-white/10 px-4 py-4">Comercios, farmacias y locales cerca de tu direccion.</div>
            <div className="rounded-[22px] bg-white/10 px-4 py-4">Pedidos faciles de seguir desde la compra hasta la entrega.</div>
            <div className="rounded-[22px] bg-white/10 px-4 py-4">Montos claros y confirmados antes de finalizar tu pedido.</div>
          </div>
        </div>
      </div>
    </section>
  );
}
