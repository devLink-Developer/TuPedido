import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { Link, useLocation, useMatch, useNavigate } from "react-router-dom";
import { ActiveOrderBar } from "../../modules/cliente/components/ActiveOrderBar";
import { OrderReviewPrompt } from "../../modules/cliente/components/OrderReviewPrompt";
import { BrandMark } from "../../shared/components";
import { useAuthSession, useCart } from "../../shared/hooks";
import { usePlatformBranding } from "../../shared/providers/PlatformBrandingProvider";
import { createOrderReview, fetchAddresses, fetchPendingOrderReview } from "../../shared/services/api";
import { useClienteStore } from "../../shared/stores";
import type { Address, CreateOrderReviewPayload, PendingOrderReview } from "../../shared/types";
import { formatCurrency } from "../../shared/utils/format";
import {
  ORDER_REVIEW_PROMPT_REFRESH_EVENT,
  dismissOrderReviewPrompt,
  getDismissedOrderReviewId
} from "../../shared/utils/orderReviewPrompt";
import { CUSTOMER_ADDRESSES_CHANGED_EVENT } from "../../shared/utils/customerAddresses";

export function ClienteLayout({ children }: PropsWithChildren) {
  const navigate = useNavigate();
  const location = useLocation();
  const orderTrackingMatch = useMatch("/c/pedido/:id");
  const menuRef = useRef<HTMLDivElement | null>(null);
  const lastScrollYRef = useRef(0);
  const { user, token, isAuthenticated, logout } = useAuthSession();
  const { brandName, branding } = usePlatformBranding();
  const { itemCount, storeName, total } = useCart();
  const selectedAddressId = useClienteStore((state) => state.selectedAddressId);
  const setSelectedAddressId = useClienteStore((state) => state.setSelectedAddressId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [navbarVisible, setNavbarVisible] = useState(true);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [pendingReview, setPendingReview] = useState<PendingOrderReview | null>(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const showFloatingCart = location.pathname !== "/c/carrito" && location.pathname !== "/c/checkout" && itemCount > 0;
  const showAddressSelector = isAuthenticated && user?.role === "customer";
  const showActiveOrderBar = !orderTrackingMatch;
  const themedFieldClassName = "app-input w-full text-sm font-semibold";
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

  const loadPendingReview = useCallback(async () => {
    if (!isAuthenticated || user?.role !== "customer" || !token) {
      setPendingReview(null);
      setReviewError(null);
      return;
    }

    if (getDismissedOrderReviewId() !== null) {
      setPendingReview(null);
      setReviewError(null);
      return;
    }

    try {
      const nextPendingReview = await fetchPendingOrderReview(token);
      setPendingReview(nextPendingReview);
      setReviewError(null);
    } catch {
      setPendingReview(null);
    }
  }, [isAuthenticated, token, user?.role]);

  useEffect(() => {
    void loadPendingReview();
  }, [loadPendingReview]);

  useEffect(() => {
    if (!showAddressSelector || !token) {
      return;
    }

    const handleFocus = () => {
      void loadPendingReview();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadPendingReview();
      }
    };
    const handleRefreshEvent = () => {
      void loadPendingReview();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener(ORDER_REVIEW_PROMPT_REFRESH_EVENT, handleRefreshEvent);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener(ORDER_REVIEW_PROMPT_REFRESH_EVENT, handleRefreshEvent);
    };
  }, [loadPendingReview, showAddressSelector, token]);

  const handleSkipReview = useCallback(() => {
    if (!pendingReview) {
      return;
    }

    dismissOrderReviewPrompt(pendingReview.order_id);
    setPendingReview(null);
    setReviewError(null);
  }, [pendingReview]);

  const handleSubmitReview = useCallback(
    async (payload: CreateOrderReviewPayload) => {
      if (!token || !pendingReview) {
        return;
      }

      setReviewSubmitting(true);
      setReviewError(null);
      try {
        await createOrderReview(token, pendingReview.order_id, payload);
        await loadPendingReview();
      } catch (submissionError) {
        setReviewError(submissionError instanceof Error ? submissionError.message : "No se pudo guardar la calificacion");
      } finally {
        setReviewSubmitting(false);
      }
    },
    [loadPendingReview, pendingReview, token]
  );

  return (
    <div className="app-shell ambient-grid min-h-screen text-ink">
      <header
        className={`fixed inset-x-0 top-0 z-30 transition-transform duration-200 ${
          navbarVisible ? "translate-y-0" : "-translate-y-[calc(100%+0.75rem)]"
        }`}
      >
        <div className="app-toolbar w-full border-x-0">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3 px-4 py-4 md:px-8">
            <Link to="/c" aria-label={`Ir al catalogo de ${brandName}`} className="shrink-0">
              <BrandMark
                brandName={brandName}
                logoUrl={branding?.platform_logo_url ?? null}
                imageClassName="h-9 max-w-[8.5rem] drop-shadow-[0_10px_20px_rgba(173,74,14,0.14)] sm:h-10 sm:max-w-[10rem]"
                textClassName="text-[1.45rem] text-[#24130e]"
              />
            </Link>

            {showAddressSelector ? (
              <div className="order-3 min-w-0 basis-full md:order-none md:flex-1">
                {addressesLoading ? (
                  <div className="h-[50px] w-full animate-pulse border border-white/70 bg-white/84 shadow-sm" />
                ) : addresses.length > 1 ? (
                  <select
                    value={selectedAddress?.id ?? ""}
                    onChange={(event) => setSelectedAddressId(event.target.value ? Number(event.target.value) : "")}
                    aria-label="Define tu direccion de entrega"
                    className={themedFieldClassName}
                    style={{ borderColor: "var(--catalog-accent-border)" }}
                  >
                    {addresses.map((address) => (
                      <option key={address.id} value={address.id}>
                        {address.label} | {address.street}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Link
                    to="/c/perfil"
                    className="app-input block min-h-[50px] border-[var(--catalog-accent-border)] px-4 py-3"
                    style={{ borderColor: "var(--catalog-accent-border)" }}
                  >
                    <span className="hidden">{selectedAddress?.label ?? ""}</span>
                    <span className="block truncate text-sm font-semibold text-ink">
                      {selectedAddress ? `${selectedAddress.street} | ${selectedAddress.details}` : "Define tu direccion de entrega"}
                    </span>
                  </Link>
                )}
              </div>
            ) : (
              <div className="hidden flex-1 md:block" />
            )}

            {isAuthenticated ? (
              <div ref={menuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((current) => !current)}
                  className="flex min-h-[46px] items-center gap-3 border bg-white/92 px-3 py-2 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-white"
                  style={{ borderColor: "var(--catalog-accent-border)" }}
                >
                  <span
                    className="flex h-9 w-9 items-center justify-center border border-black/10 text-xs font-bold text-white"
                    style={{ backgroundColor: "var(--catalog-accent)" }}
                  >
                    {user?.full_name?.trim().charAt(0).toUpperCase() || "P"}
                  </span>
                  <span className="hidden text-left md:block">
                    <span className="block text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Cuenta</span>
                    <span className="block">Mi perfil</span>
                  </span>
                </button>
                {menuOpen ? (
                  <div
                    className="app-panel absolute right-0 top-[calc(100%+0.75rem)] z-40 min-w-[220px] max-w-[min(92vw,280px)] p-2"
                    style={{ borderColor: "var(--catalog-accent-border)" }}
                  >
                    <Link
                      to="/c/pedidos"
                      className="block border border-transparent px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:border-black/8 hover:bg-zinc-50 hover:text-ink"
                    >
                      Mis pedidos
                    </Link>
                    <Link
                      to="/c/perfil"
                      className="block border border-transparent px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:border-black/8 hover:bg-zinc-50 hover:text-ink"
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
                      className="mt-1 w-full border border-transparent px-4 py-3 text-left text-sm font-semibold text-rose-700 transition hover:border-rose-100 hover:bg-rose-50"
                    >
                      Cerrar sesion
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main className={`mx-auto w-full max-w-6xl px-4 pt-[9rem] md:px-8 md:pt-28 ${showFloatingCart ? "pb-28 md:pb-24" : "pb-10"}`}>
        {showActiveOrderBar ? <ActiveOrderBar /> : null}
        {children}
      </main>

      {showFloatingCart ? (
        <>
          <Link
            to="/c/carrito"
            aria-label={`Abrir carrito con ${itemCount} productos`}
            className="fixed bottom-[calc(1rem+var(--safe-bottom))] right-4 z-40 inline-flex h-16 w-16 items-center justify-center border border-black/10 text-sm font-semibold text-white transition hover:opacity-95 md:hidden"
            style={{
              backgroundImage: "linear-gradient(135deg, #ff7b46 0%, var(--catalog-accent) 48%, #be2600 100%)",
              boxShadow: "0 18px 40px -18px var(--catalog-accent-shadow)"
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
              <path d="M4.5 6h1.25l1.1 7.05a1 1 0 0 0 .98.8h8.77a1 1 0 0 0 .97-.76L19 8.25H7.2" />
              <circle cx="9.25" cy="18.25" r="1.35" />
              <circle cx="16.75" cy="18.25" r="1.35" />
            </svg>
            <span className="absolute -right-1 -top-1 inline-flex min-w-6 items-center justify-center border border-white/15 bg-ink px-2 py-1 text-xs font-bold text-white">
              {itemCount}
            </span>
          </Link>
          <Link
            to="/c/carrito"
            aria-label={`Abrir carrito con ${itemCount} productos`}
            className="app-panel fixed bottom-6 right-6 z-40 hidden min-w-[320px] max-w-[360px] items-center justify-between gap-4 px-5 py-4 text-ink transition hover:-translate-y-0.5 md:flex"
            style={{
              borderColor: "var(--catalog-accent-border)",
              boxShadow: "0 22px 44px -24px var(--catalog-accent-shadow)"
            }}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center border border-black/10 text-white"
                style={{ backgroundColor: "var(--catalog-accent)" }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                  <path d="M4.5 6h1.25l1.1 7.05a1 1 0 0 0 .98.8h8.77a1 1 0 0 0 .97-.76L19 8.25H7.2" />
                  <circle cx="9.25" cy="18.25" r="1.35" />
                  <circle cx="16.75" cy="18.25" r="1.35" />
                </svg>
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-400">Carrito activo</p>
                <p className="mt-1 truncate text-sm font-semibold text-ink">
                  {itemCount} productos en {storeName ?? "tu pedido"}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-black text-ink">{formatCurrency(total)}</p>
              <p className="text-xs font-semibold" style={{ color: "var(--catalog-accent)" }}>
                Ver carrito
              </p>
            </div>
          </Link>
        </>
      ) : null}

      {pendingReview ? (
        <OrderReviewPrompt
          review={pendingReview}
          submitError={reviewError}
          submitting={reviewSubmitting}
          onSkip={handleSkipReview}
          onSubmit={handleSubmitReview}
        />
      ) : null}
    </div>
  );
}
