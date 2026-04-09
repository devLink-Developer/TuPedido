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
    <div className="app-shell min-h-screen text-ink">
      <header className="px-4 pt-[calc(0.85rem+var(--safe-top))] md:px-6 md:pt-5">
        <div className="app-panel-dark mx-auto flex max-w-[1200px] flex-col gap-4 rounded-[28px] px-4 py-4 md:flex-row md:items-center md:justify-between md:px-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#ffd0ba]/70">Rider</p>
            <h1 className="mt-2 font-display text-[1.7rem] font-bold leading-[1.08] tracking-tight sm:text-[2.1rem]">
              Operacion en ruta
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/68">
              Navegacion rapida para tomar pedidos, cerrar entregas y revisar ganancias sin cambiar de contexto.
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/r"}
                className={({ isActive }) =>
                  [
                    "rounded-full px-3.5 py-1.5 text-center text-[13px] font-semibold transition",
                    isActive ? "app-sidebar-link-active" : "app-sidebar-link"
                  ].join(" ")
                }
              >
                {item.label}
              </NavLink>
            ))}
            <div className="ml-0 w-full rounded-full border border-white/10 bg-white/8 px-3.5 py-1.5 text-[13px] text-white/80 sm:w-auto md:ml-2">
              <p className="font-semibold text-white">{user?.full_name ?? "Rider"}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                logout();
                navigate("/login", { replace: true });
              }}
              className="w-full rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-[13px] font-semibold text-white transition hover:bg-white hover:text-ink sm:w-auto"
            >
              Cerrar sesion
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1200px] px-4 py-5 md:px-6 md:py-6">{children}</main>
    </div>
  );
}
