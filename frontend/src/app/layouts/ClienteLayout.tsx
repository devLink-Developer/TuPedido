import { useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { Link, useLocation, useMatch, useNavigate } from "react-router-dom";
import { fetchAddresses } from "../../shared/services/api";
import { useAuthSession, useCart } from "../../shared/hooks";
import { useClienteStore } from "../../shared/stores";
import type { Address } from "../../shared/types";
import { CUSTOMER_ADDRESSES_CHANGED_EVENT } from "../../shared/utils/customerAddresses";
import { ActiveOrderBar } from "../../modules/cliente/components/ActiveOrderBar";

export function ClienteLayout({ children }: PropsWithChildren) {
  const navigate = useNavigate();
  const location = useLocation();
  const orderTrackingMatch = useMatch("/c/pedido/:id");
  const menuRef = useRef<HTMLDivElement | null>(null);
  const lastScrollYRef = useRef(0);
  const { user, token, isAuthenticated, logout } = useAuthSession();
  const { itemCount } = useCart();
  const selectedAddressId = useClienteStore((state) => state.selectedAddressId);
  const setSelectedAddressId = useClienteStore((state) => state.setSelectedAddressId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [navbarVisible, setNavbarVisible] = useState(true);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const showFloatingCart = location.pathname !== "/c/carrito" && location.pathname !== "/c/checkout" && itemCount > 0;
  const showAddressSelector = isAuthenticated && user?.role === "customer";
  const showActiveOrderBar = !orderTrackingMatch;
  const selectedAddress = useMemo(
    () => addresses.find((address) => address.id === selectedAddressId) ?? null,
    [addresses, selectedAddressId]
  );

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

  useEffect(() => {
    if (!showAddressSelector || !token) {
      setAddresses([]);
      return;
    }

    const authToken = token;
    let cancelled = false;

    async function loadAddresses() {
      setAddressesLoading(true);
      try {
        const items = await fetchAddresses(authToken);
        if (!cancelled) {
          setAddresses(items);
        }
      } catch {
        if (!cancelled) {
          setAddresses([]);
        }
      } finally {
        if (!cancelled) {
          setAddressesLoading(false);
        }
      }
    }

    void loadAddresses();

    function handleAddressesChanged() {
      void loadAddresses();
    }

    window.addEventListener(CUSTOMER_ADDRESSES_CHANGED_EVENT, handleAddressesChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(CUSTOMER_ADDRESSES_CHANGED_EVENT, handleAddressesChanged);
    };
  }, [location.pathname, showAddressSelector, token]);

  useEffect(() => {
    if (!addresses.length) {
      if (selectedAddressId !== "") {
        setSelectedAddressId("");
      }
      return;
    }

    if (addresses.some((address) => address.id === selectedAddressId)) {
      return;
    }

    const defaultAddress = addresses.find((address) => address.is_default) ?? addresses[0];
    setSelectedAddressId(defaultAddress?.id ?? "");
  }, [addresses, selectedAddressId, setSelectedAddressId]);

  return (
    <div className="ambient-grid min-h-screen text-ink">
      <header
        className={`fixed inset-x-0 top-0 z-30 border-b border-black/5 bg-[rgba(255,251,246,0.88)] py-3 backdrop-blur transition-transform duration-200 ${
          navbarVisible ? "translate-y-0" : "-translate-y-[calc(100%+0.75rem)]"
        }`}
      >
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 md:px-8">
          <Link to="/c" aria-label="Ir al catalogo" className="shrink-0">
            <img src="/icons/icon-192.svg" alt="TuPedido" className="h-11 w-11 rounded-[1.2rem] shadow-float" />
          </Link>
          {showAddressSelector ? (
            <div className="min-w-0 flex-1">
              {addressesLoading ? (
                <div className="h-[46px] w-full animate-pulse rounded-2xl bg-white shadow-sm" />
              ) : addresses.length > 1 ? (
                <select
                  value={selectedAddress?.id ?? ""}
                  onChange={(event) => setSelectedAddressId(event.target.value ? Number(event.target.value) : "")}
                  aria-label="Define tu direccion de entrega"
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-ink shadow-sm outline-none transition focus:border-brand-500"
                >
                  {addresses.map((address) => (
                    <option key={address.id} value={address.id}>
                      {address.label} · {address.street}
                    </option>
                  ))}
                </select>
              ) : (
                <Link
                  to="/c/perfil"
                  className="block rounded-2xl border border-black/10 bg-white px-4 py-3 shadow-sm transition hover:border-brand-200"
                >
                  <span className="hidden">
                    {selectedAddress?.label ?? ""}
                  </span>
                  <span className="block truncate text-sm font-semibold text-ink">
                    {selectedAddress ? `${selectedAddress.street} · ${selectedAddress.details}` : "Define tu direccion de entrega"}
                  </span>
                </Link>
              )}
            </div>
          ) : (
            <div className="flex-1" />
          )}
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
                  <span className="block text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Cuenta</span>
                  <span className="block">Mi perfil</span>
                </span>
              </button>
              {menuOpen ? (
                <div className="absolute right-0 top-[calc(100%+0.75rem)] z-40 min-w-[220px] rounded-[24px] border border-black/5 bg-white p-2 shadow-[0_18px_36px_rgba(24,19,18,0.14)]">
                  <Link
                    to="/c/pedidos"
                    className="block rounded-[18px] px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 hover:text-ink"
                  >
                    Mis pedidos
                  </Link>
                  <Link
                    to="/c/perfil"
                    className="block rounded-[18px] px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 hover:text-ink"
                  >
                    Mi perfil
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAddressId("");
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
          ) : null}
        </div>
      </header>
      <main className={`mx-auto w-full max-w-6xl px-4 pt-24 md:px-8 ${showFloatingCart ? "pb-28 md:pb-10" : "pb-10"}`}>
        {showActiveOrderBar ? <ActiveOrderBar /> : null}
        {children}
      </main>
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
