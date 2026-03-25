import type { PropsWithChildren } from "react";
import { Link, NavLink } from "react-router-dom";
import { useCart } from "../../shared/hooks";
import { useUiStore } from "../../shared/stores";

const navItems = [
  { to: "/c", label: "Inicio" },
  { to: "/c/carrito", label: "Carrito" },
  { to: "/c/checkout", label: "Checkout" }
];

export function ClienteLayout({ children }: PropsWithChildren) {
  const { itemCount } = useCart();
  const setCartDrawerOpen = useUiStore((state) => state.setCartDrawerOpen);

  return (
    <div className="ambient-grid min-h-screen text-ink">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-[rgba(255,251,246,0.88)] px-4 py-4 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link to="/c" className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.2rem] bg-[linear-gradient(135deg,#fb923c,#c2410c)] text-sm font-bold text-white shadow-float">
              TP
            </span>
            <div className="min-w-0">
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-400">Cliente</p>
              <h2 className="truncate font-display text-lg font-bold tracking-tight">Comprar ahora</h2>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setCartDrawerOpen(true)}
            className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white"
          >
            Carrito ({itemCount})
          </button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 pb-28 md:px-8">{children}</main>
      <nav className="fixed bottom-[calc(0.75rem+var(--safe-bottom))] left-3 right-3 z-40 md:hidden">
        <div className="mx-auto max-w-md rounded-[30px] border border-white/70 bg-[rgba(255,251,246,0.96)] p-2 shadow-[0_18px_40px_rgba(24,19,18,0.16)] backdrop-blur">
          <div className="grid grid-cols-3 gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    "relative flex min-h-[64px] flex-col items-center justify-center rounded-[22px] px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] transition",
                    isActive ? "bg-[linear-gradient(135deg,#fb923c,#c2410c)] text-white shadow-float" : "text-zinc-500"
                  ].join(" ")
                }
              >
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </nav>
    </div>
  );
}
