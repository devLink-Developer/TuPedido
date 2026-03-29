import type { PropsWithChildren } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuthSession, useRouteBoundDrawer } from "../../shared/hooks";

const navItems = [
  { to: "/a", label: "Dashboard" },
  { to: "/a/usuarios", label: "Usuarios" },
  { to: "/a/comercios", label: "Comercios" },
  { to: "/a/riders", label: "Riders" },
  { to: "/a/pedidos", label: "Pedidos" },
  { to: "/a/configuracion", label: "Configuración" }
];

export function AdminLayout({ children }: PropsWithChildren) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthSession();
  const { open, setOpen, close } = useRouteBoundDrawer();
  const activeLabel =
    navItems.find((item) => item.to === "/a" ? location.pathname === "/a" : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`))
      ?.label ?? "Control central";

  function handleLogout() {
    close();
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f2f4f8_0%,#fbfcff_100%)] text-ink">
      <div className="mx-auto flex min-h-screen max-w-[1640px] flex-col lg:flex-row">
        <aside className="hidden w-[320px] flex-col border-r border-white/10 bg-[#111827] px-6 py-6 text-white lg:flex">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-200/70">Admin</p>
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">Control central</h1>
            <div className="mt-6 grid gap-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/a"}
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
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-200/60">Sesion</p>
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
          <header className="mb-5 flex items-center justify-between gap-3 rounded-[26px] border border-black/5 bg-white/90 px-4 py-4 shadow-sm backdrop-blur lg:hidden">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-700/70">Admin</p>
              <h2 className="mt-1 text-lg font-bold text-ink">{activeLabel}</h2>
            </div>
            <button
              type="button"
              aria-label="Abrir menu admin"
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
            className="absolute inset-y-0 left-0 flex w-[min(84vw,340px)] flex-col bg-[#111827] px-6 py-6 text-white shadow-[0_24px_60px_rgba(17,24,39,0.36)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-200/70">Admin</p>
                <h2 className="mt-3 font-display text-2xl font-bold tracking-tight">Control central</h2>
              </div>
              <button
                type="button"
                aria-label="Cerrar menu admin"
                onClick={close}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white"
              >
                ×
              </button>
            </div>

            <nav className="mt-6 grid gap-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/a"}
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
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-200/60">Sesion</p>
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
