import type { PropsWithChildren } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useMerchantMobileHeader } from "../../modules/comercio/MerchantMobileHeaderContext";
import { BrandMark } from "../../shared/components";
import { useAuthSession, useRouteBoundDrawer } from "../../shared/hooks";
import { usePlatformBranding } from "../../shared/providers/PlatformBrandingProvider";

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
  const { brandName, branding } = usePlatformBranding();
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
    <div className="app-shell min-h-screen text-ink">
      <header className="hidden md:block">
        <div className="app-toolbar w-full border border-x-0 border-[var(--color-border-default)]">
          <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-4 px-4 py-4 md:px-6 lg:px-7">
            <div className="flex min-w-0 items-center gap-4">
              <Link to="/m/dashboard" aria-label={`Ir al panel de ${brandName}`} className="inline-flex items-center">
                <BrandMark
                  brandName={brandName}
                  logoUrl={branding?.platform_logo_url ?? null}
                  imageClassName="h-10 max-w-[10rem] sm:h-11 sm:max-w-[11.5rem]"
                  textClassName="text-[1.5rem] text-[#24130e]"
                />
              </Link>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8f5f4e]">Comercio</p>
                <h2 className="mt-1 truncate text-lg font-bold text-ink">{activeLabel}</h2>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden text-right lg:block">
                <p className="text-sm font-semibold text-ink">{user?.full_name ?? "Comercio"}</p>
                <p className="text-xs text-zinc-500">{user?.email ?? ""}</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex min-h-[44px] items-center border border-[var(--color-border-default)] bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-brand-200 hover:text-ink"
              >
                Cerrar sesion
              </button>
            </div>
          </div>
        </div>
      </header>
      <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col md:flex-row">
        <aside className="app-sidebar hidden w-[288px] flex-col px-5 py-5 text-white md:flex">
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#ffcfb7]/70">Comercio</p>
            <h1 className="mt-3 font-display text-[2.15rem] font-bold tracking-tight">Panel operativo</h1>
            <p className="mt-3 max-w-[15rem] text-sm leading-6 text-white/62">
              Gestiona pedidos, riders, promociones y liquidaciones con una sola jerarquía visual.
            </p>
            <div className="app-sidebar-nav mt-6">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/m/pedidos" || item.to === "/m/dashboard"}
                  className={({ isActive }) =>
                    [
                      "border border-transparent px-4 py-2.5 text-[13px] font-semibold transition",
                      isActive ? "app-sidebar-link-active" : "app-sidebar-link"
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
              className="mt-4 w-full border border-white/10 bg-white/5 px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-white hover:text-ink"
            >
              Cerrar sesion
            </button>
          </div>
        </aside>

        <main className="flex-1 px-4 pb-5 pt-0 md:px-6 md:py-6 lg:px-7">
          <header
            className={[
              "app-toolbar -mx-4 mb-4 border border-x-0 border-[var(--color-border-default)] px-4 py-3.5 md:hidden",
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
                className="inline-flex h-10 w-10 items-center justify-center border border-[var(--color-border-default)] bg-white text-ink shadow-sm"
              >
                <span className="sr-only">Menu</span>
                <span className="space-y-1.5">
                  <span className="block h-0.5 w-5 bg-current" />
                  <span className="block h-0.5 w-5 bg-current" />
                  <span className="block h-0.5 w-5 bg-current" />
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
            className="app-sidebar absolute inset-y-0 left-0 flex w-[min(82vw,300px)] flex-col px-5 py-5 text-white"
          >
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#ffcfb7]/70">Comercio</p>
                <h2 className="mt-3 font-display text-[1.6rem] font-bold leading-[1.08] tracking-tight sm:text-[1.85rem]">Panel operativo</h2>
              </div>
              <button
                type="button"
                aria-label="Cerrar menu de comercio"
                onClick={close}
                className="inline-flex h-10 w-10 items-center justify-center self-end border border-white/10 bg-white/5 text-white sm:self-auto"
              >
                ×
              </button>
            </div>

            <nav className="app-sidebar-nav mt-6">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/m/pedidos" || item.to === "/m/dashboard"}
                  onClick={close}
                className={({ isActive }) =>
                  [
                    "border border-transparent px-4 py-2.5 text-[13px] font-semibold transition",
                    isActive ? "app-sidebar-link-active" : "app-sidebar-link"
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
                className="mt-4 w-full border border-white/10 bg-white/5 px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-white hover:text-ink"
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
