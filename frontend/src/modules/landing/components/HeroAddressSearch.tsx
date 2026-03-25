import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../../shared/ui/Button";

export function HeroAddressSearch() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  return (
    <section className="ambient-grid overflow-hidden rounded-[40px] bg-[linear-gradient(135deg,#1d1614_0%,#281b18_45%,#3a221a_100%)] px-6 py-8 text-white shadow-lift md:px-8 md:py-10">
      <div className="absolute -right-10 top-6 h-36 w-36 rounded-full bg-brand-400/20 blur-3xl orb-float" />
      <div className="relative grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#ffd2bd]/80">TuPedido</p>
            <h1 className="max-w-3xl font-display text-4xl font-bold leading-[1.02] md:text-5xl">
              Todo lo que necesitas para pedir, vender y repartir en un solo lugar.
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-white/72 md:text-base">
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
        <div className="rounded-[32px] border border-white/10 bg-white/10 p-5 backdrop-blur-md">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#ffd2bd]/80">Por que elegir TuPedido</p>
          <div className="mt-4 grid gap-3 text-sm text-white/74">
            <div className="rounded-[22px] bg-white/10 px-4 py-4">Comercios, farmacias y locales cerca de tu direccion.</div>
            <div className="rounded-[22px] bg-white/10 px-4 py-4">Pedidos faciles de seguir desde la compra hasta la entrega.</div>
            <div className="rounded-[22px] bg-white/10 px-4 py-4">Montos claros y confirmados antes de finalizar tu pedido.</div>
          </div>
        </div>
      </div>
    </section>
  );
}
