import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthSession, useCart } from "../../shared/hooks";

export function ClienteLayout({ children }: PropsWithChildren) {
  const navigate = useNavigate();
  const location = useLocation();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const lastScrollYRef = useRef(0);
  const { user, isAuthenticated, logout } = useAuthSession();
  const { itemCount } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [navbarVisible, setNavbarVisible] = useState(true);
  const showFloatingCart = location.pathname !== "/c/carrito" && location.pathname !== "/c/checkout" && itemCount > 0;

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    setNavbarVisible(true);
    lastScrollYRef.current = window.scrollY;
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

  useEffect(() => {
    function handleScroll() {
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollYRef.current;

      if (menuOpen || currentScrollY <= 24) {
        setNavbarVisible(true);
        lastScrollYRef.current = currentScrollY;
        return;
      }

      if (delta > 8) {
        setNavbarVisible(false);
      } else if (delta < -8) {
        setNavbarVisible(true);
      }

      lastScrollYRef.current = currentScrollY;
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [menuOpen]);

  return (
    <div className="ambient-grid min-h-screen text-ink">
      <header
        className={`fixed inset-x-0 top-0 z-30 border-b border-black/5 bg-[rgba(255,251,246,0.88)] px-4 py-3 backdrop-blur transition-transform duration-200 md:px-8 ${
          navbarVisible ? "translate-y-0" : "-translate-y-[calc(100%+0.75rem)]"
        }`}
      >
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
      <main className={`mx-auto w-full max-w-6xl px-4 pt-24 md:px-8 ${showFloatingCart ? "pb-28 md:pb-10" : "pb-10"}`}>{children}</main>
      {showFloatingCart ? (
        <Link
          to="/c/carrito"
          aria-label={`Abrir carrito con ${itemCount} productos`}
          className="fixed bottom-[calc(1rem+var(--safe-bottom))] right-4 z-40 inline-flex h-16 w-16 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(255,61,0,0.34)] transition hover:opacity-95 md:hidden"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <path d="M4.5 6h1.25l1.1 7.05a1 1 0 0 0 .98.8h8.77a1 1 0 0 0 .97-.76L19 8.25H7.2" />
            <circle cx="9.25" cy="18.25" r="1.35" />
            <circle cx="16.75" cy="18.25" r="1.35" />
          </svg>
          <span className="absolute -right-1 -top-1 inline-flex min-w-6 items-center justify-center rounded-full bg-ink px-2 py-1 text-xs font-bold text-white">
            {itemCount}
          </span>
        </Link>
      ) : null}
    </div>
  );
}
