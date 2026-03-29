import type { PropsWithChildren } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuthSession } from "../../shared/hooks";

const navItems = [
  { to: "/m/pedidos", label: "Pedidos" },
  { to: "/m/riders", label: "Riders" },
  { to: "/m/dashboard", label: "Resumen" },
  { to: "/m/productos", label: "Productos" },
  { to: "/m/promociones", label: "Promociones" },
  { to: "/m/configuracion", label: "Configuracion" }
];

export function MerchantDashboardLayout({ children }: PropsWithChildren) {
  const navigate = useNavigate();
  const { user, logout } = useAuthSession();

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fcf6ef_0%,#fffdfa_100%)] text-ink">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col md:flex-row">
        <aside className="flex w-full flex-col border-b border-black/5 bg-[linear-gradient(180deg,#221816_0%,#171210_100%)] px-6 py-6 text-white md:w-[300px] md:border-b-0 md:border-r md:border-white/10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#ffcfb7]/70">Comercio</p>
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">Panel operativo</h1>
            <div className="mt-6 grid gap-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/m/pedidos" || item.to === "/m/dashboard"}
                  className={({ isActive }) =>
                    [
                      "rounded-[22px] px-4 py-3 text-sm font-semibold transition",
                      isActive ? "bg-white text-ink shadow-float" : "border border-white/10 bg-white/5 text-white/80"
                    ].join(" ")
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>

          <div className="mt-6 border-t border-white/10 pt-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#ffcfb7]/60">Sesion</p>
            <p className="mt-3 text-sm font-semibold text-white">{user?.full_name ?? "Comercio"}</p>
            <p className="mt-1 text-sm text-white/60">{user?.email ?? ""}</p>
            <button
              type="button"
              onClick={() => {
                logout();
                navigate("/login", { replace: true });
              }}
              className="mt-4 w-full rounded-[22px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white hover:text-ink"
            >
              Cerrar sesion
            </button>
          </div>
        </aside>
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
