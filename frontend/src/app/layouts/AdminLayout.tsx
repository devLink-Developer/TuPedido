import type { PropsWithChildren } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuthSession, useRouteBoundDrawer } from "../../shared/hooks";

const navItems = [
  { to: "/a", label: "Dashboard" },
  { to: "/a/liquidaciones", label: "Liquidaciones" },
  { to: "/a/usuarios", label: "Usuarios" },
  { to: "/a/comercios", label: "Comercios" },
  { to: "/a/riders", label: "Riders" },
  { to: "/a/pedidos", label: "Pedidos" },
  { to: "/a/configuracion", label: "Configuracion" }
];

export function AdminLayout({ children }: PropsWithChildren) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthSession();
  const { open, setOpen, close } = useRouteBoundDrawer();
  const activeLabel =
    navItems.find((item) =>
      item.to === "/a" ? location.pathname === "/a" : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
    )?.label ?? "Control central";

  function handleLogout() {
    close();
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-shell min-h-screen text-ink">
      <div className="mx-auto flex min-h-screen max-w-[1640px] flex-col lg:flex-row">
        <aside className="app-sidebar hidden w-[320px] flex-col px-6 py-6 text-white lg:flex">
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#ffd3bf]/70">Admin</p>
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">Control central</h1>
            <p className="mt-3 max-w-xs text-sm leading-7 text-white/62">
              Supervisa operaciones, liquidaciones, usuarios y configuración global con un mismo sistema visual.
            </p>
            <div className="app-sidebar-nav mt-6">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/a"}
                  className={({ isActive }) =>
                    [
                      "rounded-[22px] px-4 py-3 text-sm font-semibold transition",
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
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#ffd3bf]/60">Sesion</p>
            <p className="mt-3 text-sm font-semibold text-white">{user?.full_name ?? "Admin"}</p>
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
          <header className="app-toolbar mb-5 flex flex-col items-start gap-4 rounded-[28px] px-4 py-4 sm:flex-row sm:items-center sm:justify-between lg:hidden">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8f5f4e]">Admin</p>
              <h2 className="mt-1 text-lg font-bold text-ink">{activeLabel}</h2>
            </div>
            <button
              type="button"
              aria-label="Abrir menu admin"
              aria-expanded={open}
              onClick={() => setOpen(true)}
              className="inline-flex h-11 w-11 items-center justify-center self-end rounded-full border border-[var(--color-border-default)] bg-white text-ink shadow-sm sm:self-auto"
            >
              <span className="sr-only">Menu</span>
              <span className="space-y-1.5">
                <span className="block h-0.5 w-5 rounded-full bg-current" />
                <span className="block h-0.5 w-5 rounded-full bg-current" />
                <span className="block h-0.5 w-5 rounded-full bg-current" />
              </span>
            </button>
          </header>
          {children}
        </main>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Cerrar menu admin"
            onClick={close}
            className="absolute inset-0 bg-[rgba(17,24,39,0.48)]"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menu admin"
            className="app-sidebar absolute inset-y-0 left-0 flex w-[min(84vw,340px)] flex-col px-6 py-6 text-white"
          >
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#ffd3bf]/70">Admin</p>
                <h2 className="mt-3 font-display text-[1.75rem] font-bold leading-[1.08] tracking-tight sm:text-2xl">Control central</h2>
              </div>
              <button
                type="button"
                aria-label="Cerrar menu admin"
                onClick={close}
                className="inline-flex h-10 w-10 items-center justify-center self-end rounded-full border border-white/10 bg-white/5 text-white sm:self-auto"
              >
                ×
              </button>
            </div>

            <nav className="app-sidebar-nav mt-6">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/a"}
                  onClick={close}
                  className={({ isActive }) =>
                    [
                      "rounded-[22px] px-4 py-3 text-sm font-semibold transition",
                      isActive ? "app-sidebar-link-active" : "app-sidebar-link"
                    ].join(" ")
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="mt-auto border-t border-white/10 pt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#ffd3bf]/60">Sesion</p>
              <p className="mt-3 text-sm font-semibold text-white">{user?.full_name ?? "Admin"}</p>
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
