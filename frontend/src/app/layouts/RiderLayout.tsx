import type { PropsWithChildren } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuthSession } from "../../shared/hooks";

const navItems = [
  { to: "/r", label: "Panel" },
  { to: "/r/pedidos", label: "Pedidos" },
  { to: "/r/historial", label: "Historial" },
  { to: "/r/ganancias", label: "Ganancias" }
];

export function RiderLayout({ children }: PropsWithChildren) {
  const navigate = useNavigate();
  const { user, logout } = useAuthSession();

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eef5f2_0%,#f6fbf8_100%)] text-ink">
      <header className="border-b border-black/5 bg-[#0f1f1b] px-4 py-4 text-white md:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#9be3c1]/70">Rider</p>
            <h1 className="mt-2 font-display text-[1.85rem] font-bold leading-[1.08] tracking-tight sm:text-3xl">
              Operacion en ruta
            </h1>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/r"}
                className={({ isActive }) =>
                  [
                    "rounded-full px-4 py-2 text-center text-sm font-semibold transition",
                    isActive ? "bg-white text-ink shadow-float" : "border border-white/10 bg-white/5 text-white/80"
                  ].join(" ")
                }
              >
                {item.label}
              </NavLink>
            ))}
            <div className="ml-0 w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 sm:w-auto md:ml-2">
              <p className="font-semibold text-white">{user?.full_name ?? "Rider"}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                logout();
                navigate("/login", { replace: true });
              }}
              className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white hover:text-ink sm:w-auto"
            >
              Cerrar sesion
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}
