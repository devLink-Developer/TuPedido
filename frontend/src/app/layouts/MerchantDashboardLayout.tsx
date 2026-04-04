import type { PropsWithChildren } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useMerchantMobileHeader } from "../../modules/comercio/MerchantMobileHeaderContext";
import { useAuthSession, useRouteBoundDrawer } from "../../shared/hooks";

const navItems = [
  { to: "/m/pedidos", label: "Pedidos" },
  { to: "/m/riders", label: "Riders" },
  { to: "/m/dashboard", label: "Resumen" },
  { to: "/m/liquidaciones", label: "Liquidaciones" },
  { to: "/m/productos", label: "Productos" },
  { to: "/m/promociones", label: "Promociones" },
  { to: "/m/configuracion", label: "Configuracion" }
];

export function MerchantDashboardLayout({ children }: PropsWithChildren) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthSession();
  const { open, setOpen, close } = useRouteBoundDrawer();
  const { mobileHeaderAction } = useMerchantMobileHeader();
  const activeLabel =
    navItems.find((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`))?.label ??
    "Panel operativo";

  function handleLogout() {
    close();
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fcf6ef_0%,#fffdfa_100%)] text-ink">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col md:flex-row">
        <aside className="hidden w-[300px] flex-col border-r border-white/10 bg-[linear-gradient(180deg,#221816_0%,#171210_100%)] px-6 py-6 text-white md:flex">
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
              onClick={handleLogout}
              className="mt-4 w-full rounded-[22px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white hover:text-ink"
            >
              Cerrar sesion
            </button>
          </div>
        </aside>
        <main className="flex-1 px-4 py-6 md:px-8">
          <header
            className={[
              "mb-5 rounded-[26px] border border-black/5 bg-white/80 px-4 py-4 shadow-sm backdrop-blur md:hidden",
              mobileHeaderAction
                ? "flex items-start justify-between gap-3"
                : "flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between"
            ].join(" ")}
          >
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8f5f4e]">Comercio</p>
              <h2 className="mt-1 text-lg font-bold text-ink">{activeLabel}</h2>
            </div>
            <div className={`flex shrink-0 items-center gap-2 ${mobileHeaderAction ? "self-start" : "self-end sm:self-auto"}`}>
              {mobileHeaderAction ? <div className="flex shrink-0 items-center">{mobileHeaderAction}</div> : null}
              <button
                type="button"
                aria-label="Abrir menu de comercio"
                aria-expanded={open}
                onClick={() => setOpen(true)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white text-ink shadow-sm"
              >
                <span className="sr-only">Menu</span>
                <span className="space-y-1.5">
                  <span className="block h-0.5 w-5 rounded-full bg-current" />
                  <span className="block h-0.5 w-5 rounded-full bg-current" />
                  <span className="block h-0.5 w-5 rounded-full bg-current" />
                </span>
              </button>
            </div>
          </header>
          {children}
        </main>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Cerrar menu de comercio"
            onClick={close}
            className="absolute inset-0 bg-[rgba(23,18,16,0.48)]"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menu de comercio"
            className="absolute inset-y-0 left-0 flex w-[min(84vw,320px)] flex-col bg-[linear-gradient(180deg,#221816_0%,#171210_100%)] px-6 py-6 text-white shadow-[0_24px_60px_rgba(24,19,18,0.36)]"
          >
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#ffcfb7]/70">Comercio</p>
                <h2 className="mt-3 font-display text-[1.75rem] font-bold leading-[1.08] tracking-tight sm:text-2xl">Panel operativo</h2>
              </div>
              <button
                type="button"
                aria-label="Cerrar menu de comercio"
                onClick={close}
                className="inline-flex h-10 w-10 items-center justify-center self-end rounded-full border border-white/10 bg-white/5 text-white sm:self-auto"
              >
                ×
              </button>
            </div>

            <nav className="mt-6 grid gap-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/m/pedidos" || item.to === "/m/dashboard"}
                  onClick={close}
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
            </nav>

            <div className="mt-auto border-t border-white/10 pt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#ffcfb7]/60">Sesion</p>
              <p className="mt-3 text-sm font-semibold text-white">{user?.full_name ?? "Comercio"}</p>
              <p className="mt-1 text-sm text-white/60">{user?.email ?? ""}</p>
              <button
                type="button"
                onClick={handleLogout}
                className="mt-4 w-full rounded-[22px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white hover:text-ink"
              >
                Cerrar sesion
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
