import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useSession } from "../../app/session";
import { useCart } from "../../features/cart/cart-store";
import { BottomNav } from "./BottomNav";

const titles: Record<string, string> = {
  "/": "Inicio",
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
  const title = isStoreRoute ? "Tienda" : titles[location.pathname] ?? "TuPedido";
  const desktopHighlights = [
    "Despensas, farmacias, kioscos y restaurantes en una sola vitrina.",
    "Horarios, delivery y pagos claros antes de comprar.",
    "Una experiencia que ayuda a que cada comercio venda mejor."
  ];

  return (
    <div className="ambient-grid min-h-screen text-ink">
      <div className="mx-auto flex min-h-screen w-full max-w-[1520px] flex-col md:flex-row">
        <aside className="ambient-grid hidden w-[360px] overflow-hidden border-r border-white/10 bg-[linear-gradient(180deg,#1f1715_0%,#241917_58%,#120f0f_100%)] px-9 py-10 text-white md:flex md:flex-col md:justify-between">
          <div className="space-y-9">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.32),_transparent_60%)]" />
            <Link to="/" className="relative inline-flex items-center gap-3 text-2xl font-display font-bold tracking-tight">
              <span className="flex h-12 w-12 items-center justify-center rounded-[1.35rem] bg-[linear-gradient(135deg,#fb923c,#c2410c)] text-lg text-white shadow-float">TP</span>
              TuPedido
            </Link>
            <div className="relative space-y-5">
              <p className="text-sm uppercase tracking-[0.28em] text-[#ffcfb7]/70">Comercios adheridos</p>
              <h1 className="font-display text-4xl font-bold leading-tight text-white">
                Una vidriera digital hecha para que el barrio compre mejor.
              </h1>
              <p className="max-w-sm text-sm leading-7 text-white/68">
                Descubre negocios cercanos con propuesta visual, filtros claros y catalogos que ayudan a convertir.
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
            <p className="text-2xl font-display font-bold">{isAuthenticated ? user?.full_name : "Explora sin friccion"}</p>
            <p className="text-sm leading-6 text-white/60">{isAuthenticated ? user?.role : "Entra para seguir pedidos, guardar direcciones o sumar tu comercio."}</p>
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
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.2rem] border border-black/10 bg-white/80 text-lg font-bold text-ink shadow-sm">
                      {"<"}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-400">Volver al catalogo</p>
                      <h2 className="truncate font-display text-lg font-bold tracking-tight">{title}</h2>
                    </div>
                  </button>
                ) : (
                  <Link to="/" className="flex min-w-0 items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.2rem] bg-[linear-gradient(135deg,#fb923c,#c2410c)] text-sm font-bold text-white shadow-float">
                      TP
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-400">Delivery local</p>
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
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-400">Marketplace local</p>
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
