import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useSession } from "../../app/session";
import { useCart } from "../../features/cart/cart-store";
import { BrandMark, PlatformWordmark } from "../../shared/components";
import { usePlatformBranding } from "../../shared/providers/PlatformBrandingProvider";
import { BottomNav } from "./BottomNav";

const titles: Record<string, string> = {
  "/": "Pedir ahora",
  "/cart": "Carrito",
  "/checkout": "Checkout",
  "/login": "Acceso",
  "/register": "Registro",
  "/addresses": "Direcciones",
  "/orders": "Pedidos",
  "/merchant-apply": "Postulacion",
  "/delivery-apply": "Registro rider",
  "/merchant": "Comercio",
  "/admin": "Administracion",
  "/delivery": "Delivery"
};

export function MobileShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useSession();
  const { brandName, branding } = usePlatformBranding();
  const { itemCount } = useCart();
  const quickLinks = !isAuthenticated
    ? [
        { to: "/", label: "Comprar" },
        { to: "/register", label: "Cuenta" },
        { to: "/merchant-apply", label: "Vender" },
        { to: "/delivery-apply", label: "Repartir" }
      ]
    : user?.role === "customer"
      ? [
          { to: "/", label: "Comprar" },
          { to: "/orders", label: "Pedidos" },
          { to: "/merchant-apply", label: "Vender" }
        ]
      : user?.role === "merchant"
        ? [
            { to: "/", label: "Marketplace" },
            { to: "/merchant", label: "Panel" },
            { to: "/orders", label: "Pedidos" }
          ]
        : user?.role === "delivery"
          ? [
              { to: "/", label: "Marketplace" },
              { to: "/delivery", label: "Ruta" },
              { to: "/orders", label: "Tracking" }
            ]
        : [
            { to: "/", label: "Marketplace" },
            { to: "/admin", label: "Admin" },
            { to: "/orders", label: "Pedidos" }
          ];
  const isStoreRoute = location.pathname.startsWith("/stores/") || location.pathname.startsWith("/restaurants/");
  const title = isStoreRoute ? (
    "Tienda"
  ) : (
    titles[location.pathname] ?? (
      <PlatformWordmark
        size="inline"
        frameClassName="w-[8rem]"
        textClassName="text-xl"
      />
    )
  );
  const desktopHighlights = [
    "Abiertos primero, cerrados despues por proxima apertura.",
    "Filtros rapidos por rubro, delivery o retiro.",
    "Entra directo a la tienda y arma tu pedido."
  ];

  return (
    <div className="ambient-grid min-h-screen text-ink">
      <div className="mx-auto flex min-h-screen w-full max-w-[1520px] flex-col md:flex-row">
        <aside className="ambient-grid hidden w-[360px] overflow-hidden border-r border-white/10 bg-[linear-gradient(180deg,#1f1715_0%,#241917_58%,#120f0f_100%)] px-9 py-10 text-white md:flex md:flex-col md:justify-between">
          <div className="space-y-9">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.32),_transparent_60%)]" />
            <Link to="/" aria-label={`Ir al inicio de ${brandName}`} className="relative inline-flex items-center">
              <BrandMark
                brandName={brandName}
                logoUrl={branding?.platform_logo_url ?? null}
                imageClassName="h-12 max-w-[10.5rem] drop-shadow-[0_14px_28px_rgba(191,83,15,0.22)]"
                textClassName="text-[2rem] text-white"
              />
            </Link>
            <div className="relative space-y-5">
              <p className="text-sm uppercase tracking-[0.28em] text-[#ffcfb7]/70">Pedir ahora</p>
              <h1 className="font-display text-4xl font-bold leading-tight text-white">
                Pide en comercios activos del barrio.
              </h1>
              <p className="max-w-sm text-sm leading-7 text-white/68">
                Busca por rubro, compara tiempos y entra directo a la tienda.
              </p>
            </div>
            <div className="space-y-3">
              {desktopHighlights.map((item) => (
                <div key={item} className="rounded-[26px] border border-white/10 bg-white/5 px-4 py-4 text-sm leading-6 text-white/74">
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="relative space-y-5 rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-float">
            <div className="absolute right-5 top-5 h-16 w-16 rounded-full bg-brand-500/20 blur-2xl" />
            <p className="text-xs uppercase tracking-[0.26em] text-white/50">Sesion</p>
            <p className="text-2xl font-display font-bold">{isAuthenticated ? user?.full_name : "Accede a tu cuenta"}</p>
            <p className="text-sm leading-6 text-white/60">{isAuthenticated ? user?.role : "Ingresa para seguir pedidos, guardar direcciones y cerrar mas rapido tu compra."}</p>
            {isAuthenticated ? (
              <button
                type="button"
                onClick={logout}
                className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/90 transition hover:bg-white/10"
              >
                Cerrar sesion
              </button>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Link className="rounded-full bg-[linear-gradient(135deg,#fb923c,#c2410c)] px-4 py-2 text-sm font-semibold text-white shadow-float" to="/login">
                  Ingresar
                </Link>
                <Link className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/90" to="/register">
                  Crear cuenta
                </Link>
              </div>
            )}
          </div>
        </aside>

        <main className="flex-1 pb-[calc(var(--bottom-nav-height)+1.5rem+var(--safe-bottom))] md:pb-0">
          <header className="sticky top-0 z-30 border-b border-black/5 bg-[rgba(255,251,246,0.88)] px-4 pb-4 pt-[calc(1rem+var(--safe-top))] backdrop-blur md:px-8 md:py-4">
            <div className="mx-auto max-w-6xl">
              <div className="flex items-center justify-between gap-4 md:hidden">
                {isStoreRoute ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.history.length > 1) {
                        navigate(-1);
                        return;
                      }
                      navigate("/");
                    }}
                    className="flex min-w-0 items-center gap-3 text-left"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.2rem] border border-black/10 bg-white/80 shadow-sm">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 text-ink">
                        <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-400">Volver al catalogo</p>
                      <h2 className="truncate font-display text-lg font-bold tracking-tight">{title}</h2>
                    </div>
                  </button>
                ) : (
                  <Link to="/" className="flex min-w-0 items-center gap-3">
                    <BrandMark
                      brandName={brandName}
                      logoUrl={branding?.platform_logo_url ?? null}
                      imageClassName="h-9 max-w-[8.5rem] shrink-0 drop-shadow-[0_10px_20px_rgba(173,74,14,0.14)]"
                      textClassName="shrink-0 text-[1.4rem] text-[#24130e]"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-400">Comercios activos</p>
                      <h2 className="truncate font-display text-lg font-bold tracking-tight">{title}</h2>
                    </div>
                  </Link>
                )}
                <div className="flex shrink-0 items-center gap-2">
                  {isStoreRoute && itemCount > 0 ? (
                    <Link
                      to="/cart"
                      className="rounded-full bg-ink px-3 py-2 text-xs font-semibold text-white shadow-float"
                    >
                      Carrito ({itemCount})
                    </Link>
                  ) : isAuthenticated ? (
                    <button
                      type="button"
                      onClick={logout}
                      className="rounded-full border border-black/10 bg-white/80 px-3 py-2 text-xs font-semibold text-zinc-700"
                    >
                      Salir
                    </button>
                  ) : (
                    <Link className="rounded-full bg-[linear-gradient(135deg,#fb923c,#c2410c)] px-3 py-2 text-xs font-semibold text-white shadow-float" to="/login">
                      Ingresar
                    </Link>
                  )}
                </div>
              </div>

              <div className={`mt-3 gap-2 overflow-x-auto pb-1 md:hidden hide-scrollbar ${isStoreRoute ? "hidden" : "flex"}`}>
                {quickLinks.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      [
                        "whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition",
                        isActive ? "bg-ink text-white shadow-float" : "border border-black/10 bg-white/85 text-zinc-700"
                      ].join(" ")
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>

              <div className="hidden items-center justify-between gap-4 md:flex">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-400">Comercios activos</p>
                  <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
                </div>
                <div className="hidden items-center gap-2 lg:flex">
                  {quickLinks.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        [
                          "rounded-full px-4 py-2 text-sm font-semibold transition",
                          isActive ? "bg-ink text-white shadow-float" : "border border-black/10 bg-white/80 text-zinc-700"
                        ].join(" ")
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  {isAuthenticated ? (
                    <>
                      <span className="hidden rounded-full border border-black/10 bg-white/80 px-4 py-2 text-sm font-semibold text-zinc-700 lg:inline-flex">
                        {user?.role}
                      </span>
                      <button
                        type="button"
                        onClick={logout}
                        className="rounded-full border border-black/10 bg-white/80 px-4 py-2 text-sm font-semibold text-zinc-700"
                      >
                        Salir
                      </button>
                    </>
                  ) : (
                    <>
                      <Link className="rounded-full border border-black/10 bg-white/80 px-4 py-2 text-sm font-semibold text-zinc-700" to="/login">
                        Ingresar
                      </Link>
                      <Link className="rounded-full bg-[linear-gradient(135deg,#fb923c,#c2410c)] px-4 py-2 text-sm font-semibold text-white shadow-float" to="/register">
                        Crear cuenta
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>
          </header>
          <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
            <Outlet />
          </div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
