import type { PropsWithChildren } from "react";
import type { LucideIcon } from "lucide-react";
import { BadgePercent, BarChart3, Bike, ClipboardList, Menu, Package, Settings, WalletCards, X } from "lucide-react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useMerchantMobileHeader } from "../../modules/comercio/MerchantMobileHeaderContext";
import { BrandMark } from "../../shared/components";
import { useAuthSession, useRouteBoundDrawer } from "../../shared/hooks";
import { usePlatformBranding } from "../../shared/providers/PlatformBrandingProvider";

type MerchantNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

type MerchantNavSection = {
  label: string;
  items: MerchantNavItem[];
};

const navSections: MerchantNavSection[] = [
  {
    label: "Operación",
    items: [
      { to: "/m/pedidos", label: "Pedidos", icon: ClipboardList },
      { to: "/m/riders", label: "Repartidores", icon: Bike }
    ]
  },
  {
    label: "Comercial",
    items: [
      { to: "/m/productos", label: "Catálogo", icon: Package },
      { to: "/m/promociones", label: "Promociones", icon: BadgePercent }
    ]
  },
  {
    label: "Finanzas",
    items: [
      { to: "/m/dashboard", label: "Resumen", icon: BarChart3 },
      { to: "/m/liquidaciones", label: "Liquidaciones", icon: WalletCards }
    ]
  },
  {
    label: "Ajustes",
    items: [{ to: "/m/configuracion", label: "Configuración", icon: Settings }]
  }
];

const navItems = navSections.flatMap((section) =>
  section.items.map((item) => ({
    ...item,
    sectionLabel: section.label
  }))
);

function MerchantNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="app-sidebar-nav mt-6 space-y-5" aria-label="Navegación de comercio">
      {navSections.map((section) => (
        <section key={section.label} aria-label={section.label}>
          <p className="mb-2 px-4 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#ffcfb7]/62">
            {section.label}
          </p>
          <div className="space-y-1">
            {section.items.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/m/pedidos" || item.to === "/m/dashboard"}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    [
                      "flex min-h-[44px] items-center gap-3 border border-transparent px-4 py-2.5 text-[13px] font-semibold transition",
                      isActive ? "app-sidebar-link-active" : "app-sidebar-link"
                    ].join(" ")
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );
}

export function MerchantDashboardLayout({ children }: PropsWithChildren) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthSession();
  const { brandName } = usePlatformBranding();
  const { open, setOpen, close } = useRouteBoundDrawer();
  const { mobileHeaderAction } = useMerchantMobileHeader();
  const activeItem = navItems.find((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`));
  const activeLabel = activeItem?.label ?? "Panel operativo";
  const activeSectionLabel = activeItem?.sectionLabel ?? "Comercio";

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
                  imageClassName="h-10 max-w-[10rem] sm:h-11 sm:max-w-[11.5rem]"
                  textClassName="text-[1.5rem] text-[#24130e]"
                />
              </Link>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8f5f4e]">
                  Comercio / {activeSectionLabel}
                </p>
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
                Cerrar sesión
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
              Gestiona pedidos, repartidores, promociones y liquidaciones con una sola jerarquía visual.
            </p>
            <MerchantNav />
          </div>

          <div className="mt-6 border-t border-white/10 pt-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#ffcfb7]/60">Sesión</p>
            <p className="mt-3 text-sm font-semibold text-white">{user?.full_name ?? "Comercio"}</p>
            <p className="mt-1 text-sm text-white/60">{user?.email ?? ""}</p>
            <button
              type="button"
              onClick={handleLogout}
              className="mt-4 w-full border border-white/10 bg-white/5 px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-white hover:text-ink"
            >
              Cerrar sesión
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8f5f4e]">
                Comercio / {activeSectionLabel}
              </p>
              <h2 className="mt-1 text-lg font-bold text-ink">{activeLabel}</h2>
            </div>
            <div className={`flex shrink-0 items-center gap-2 ${mobileHeaderAction ? "self-start" : "self-end sm:self-auto"}`}>
              {mobileHeaderAction ? <div className="flex shrink-0 items-center">{mobileHeaderAction}</div> : null}
              <button
                type="button"
                aria-label="Abrir menú de comercio"
                aria-expanded={open}
                onClick={() => setOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center border border-[var(--color-border-default)] bg-white text-ink shadow-sm"
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
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
            aria-label="Cerrar menú de comercio"
            onClick={close}
            className="absolute inset-0 bg-[rgba(92,52,24,0.24)] backdrop-blur-[2px]"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menú de comercio"
            className="app-sidebar absolute inset-y-0 left-0 flex w-[min(86vw,320px)] flex-col overflow-y-auto px-5 py-5 text-white"
          >
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#ffcfb7]/70">Comercio</p>
                <h2 className="mt-3 font-display text-[1.6rem] font-bold leading-[1.08] tracking-tight sm:text-[1.85rem]">Panel operativo</h2>
              </div>
              <button
                type="button"
                aria-label="Cerrar menú de comercio"
                onClick={close}
                className="inline-flex h-10 w-10 items-center justify-center self-end border border-white/10 bg-white/5 text-white sm:self-auto"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <MerchantNav onNavigate={close} />

            <div className="mt-auto border-t border-white/10 pt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#ffcfb7]/60">Sesión</p>
              <p className="mt-3 text-sm font-semibold text-white">{user?.full_name ?? "Comercio"}</p>
              <p className="mt-1 text-sm text-white/60">{user?.email ?? ""}</p>
              <button
                type="button"
                onClick={handleLogout}
                className="mt-4 w-full border border-white/10 bg-white/5 px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-white hover:text-ink"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
