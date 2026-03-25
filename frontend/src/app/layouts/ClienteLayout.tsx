import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuthSession } from "../../shared/hooks";

const navItems = [
  { to: "/c", label: "Inicio" },
  { to: "/c/carrito", label: "Carrito" },
  { to: "/c/checkout", label: "Checkout" }
];

export function ClienteLayout({ children }: PropsWithChildren) {
  const navigate = useNavigate();
  const location = useLocation();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { user, isAuthenticated, logout } = useAuthSession();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  return (
    <div className="ambient-grid min-h-screen text-ink">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-[rgba(255,251,246,0.88)] px-4 py-3 backdrop-blur md:px-8">
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
          {isAuthenticated ? (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((current) => !current)}
                className="flex items-center gap-3 rounded-full border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-ink shadow-sm"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">
                  {user?.full_name?.trim().charAt(0).toUpperCase() || "P"}
                </span>
                <span className="hidden text-left md:block">
                  <span className="block max-w-[180px] truncate text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                    Perfil
                  </span>
                  <span className="block max-w-[180px] truncate">{user?.full_name ?? "Mi cuenta"}</span>
                </span>
              </button>
              {menuOpen ? (
                <div className="absolute right-0 top-[calc(100%+0.75rem)] z-40 min-w-[220px] rounded-[24px] border border-black/5 bg-white p-2 shadow-[0_18px_36px_rgba(24,19,18,0.14)]">
                  <Link
                    to="/c/perfil"
                    className="block rounded-[18px] px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 hover:text-ink"
                  >
                    Mi perfil
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      navigate("/login", { replace: true });
                    }}
                    className="mt-1 w-full rounded-[18px] px-4 py-3 text-left text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                  >
                    Cerrar sesion
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <Link to="/login" className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">
              Ingresar
            </Link>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 pb-28 md:px-8">{children}</main>
      <nav className="fixed bottom-[calc(0.5rem+var(--safe-bottom))] left-3 right-3 z-40 md:hidden">
        <div className="mx-auto max-w-md rounded-[28px] border border-white/70 bg-[rgba(255,251,246,0.96)] p-1.5 shadow-[0_18px_40px_rgba(24,19,18,0.16)] backdrop-blur">
          <div className="grid grid-cols-3 gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    "relative flex min-h-[56px] flex-col items-center justify-center rounded-[20px] px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] transition",
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
