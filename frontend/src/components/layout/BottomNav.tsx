import { NavLink } from "react-router-dom";
import { useSession } from "../../app/session";
import { useCart } from "../../features/cart/cart-store";

const guestItems = [
  { to: "/", label: "Inicio", icon: "home" },
  { to: "/login", label: "Acceso", icon: "login" },
  { to: "/register", label: "Cuenta", icon: "account" },
  { to: "/delivery-apply", label: "Repartir", icon: "delivery" }
];

const customerItems = [
  { to: "/", label: "Inicio", icon: "home" },
  { to: "/orders", label: "Pedidos", icon: "orders" },
  { to: "/cart", label: "Carrito", icon: "cart" },
  { to: "/addresses", label: "Perfil", icon: "account" }
];

const merchantItems = [
  { to: "/", label: "Inicio", icon: "home" },
  { to: "/merchant", label: "Panel", icon: "panel" },
  { to: "/orders", label: "Pedidos", icon: "orders" }
];

const adminItems = [
  { to: "/", label: "Inicio", icon: "home" },
  { to: "/admin", label: "Admin", icon: "panel" },
  { to: "/orders", label: "Pedidos", icon: "orders" }
];

const deliveryItems = [
  { to: "/", label: "Inicio", icon: "home" },
  { to: "/delivery", label: "Ruta", icon: "delivery" },
  { to: "/orders", label: "Pedidos", icon: "orders" }
];

function BottomIcon({ name }: { name: string }) {
  switch (name) {
    case "orders":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
          <path d="M7 6.75h10" />
          <path d="M7 12h10" />
          <path d="M7 17.25h6.5" />
          <path d="M5.75 3.75h12.5a1 1 0 0 1 1 1v14.5a1 1 0 0 1-1 1H5.75a1 1 0 0 1-1-1V4.75a1 1 0 0 1 1-1Z" />
        </svg>
      );
    case "cart":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
          <path d="M4.5 6h1.25l1.1 7.05a1 1 0 0 0 .98.8h8.77a1 1 0 0 0 .97-.76L19 8.25H7.2" />
          <circle cx="9.25" cy="18.25" r="1.35" />
          <circle cx="16.75" cy="18.25" r="1.35" />
        </svg>
      );
    case "login":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
          <path d="M10.5 17.5 5 12l5.5-5.5" />
          <path d="M5.75 12h9" />
          <path d="M13.25 5.25h4a1 1 0 0 1 1 1v11.5a1 1 0 0 1-1 1h-4" />
        </svg>
      );
    case "account":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
          <circle cx="12" cy="8" r="3.2" />
          <path d="M5.5 18.25c1.45-2.6 3.72-3.9 6.5-3.9s5.05 1.3 6.5 3.9" />
        </svg>
      );
    case "store":
    case "panel":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
          <path d="M4.75 8.25 6 4.75h12l1.25 3.5" />
          <path d="M5 8.25h14v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-10Z" />
          <path d="M9.25 19.25v-5.5h5.5v5.5" />
        </svg>
      );
    case "delivery":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
          <path d="M3.75 7.75h10.5v8.5H3.75Z" />
          <path d="M14.25 10h3.5l2.5 2.75v3.5h-6" />
          <circle cx="8" cy="18" r="1.7" />
          <circle cx="18" cy="18" r="1.7" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
          <path d="M4.75 10.5 12 4.75l7.25 5.75v8a1 1 0 0 1-1 1H5.75a1 1 0 0 1-1-1v-8Z" />
          <path d="M9 19.25v-5.5h6v5.5" />
        </svg>
      );
  }
}

export function BottomNav() {
  const { user, isAuthenticated } = useSession();
  const { itemCount } = useCart();
  const items = !isAuthenticated
    ? guestItems
    : user?.role === "admin"
      ? adminItems
      : user?.role === "merchant"
        ? merchantItems
        : user?.role === "delivery"
          ? deliveryItems
          : customerItems;

  return (
    <nav className="fixed bottom-[calc(0.75rem+var(--safe-bottom))] left-3 right-3 z-40 md:hidden">
      <div className="mx-auto max-w-md rounded-[30px] border border-white/70 bg-[rgba(255,251,246,0.96)] p-2 shadow-[0_18px_40px_rgba(24,19,18,0.16)] backdrop-blur">
        <div className={`grid ${items.length === 4 ? "grid-cols-4" : "grid-cols-3"} gap-1`}>
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  "relative flex min-h-[64px] flex-col items-center justify-center rounded-[22px] px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] transition",
                  isActive || (item.to === "/cart" && itemCount > 0)
                    ? "bg-[linear-gradient(135deg,#fb923c,#c2410c)] text-white shadow-float"
                    : "text-zinc-500"
                ].join(" ")
              }
            >
              <span className="relative flex h-8 w-8 items-center justify-center rounded-2xl bg-black/5">
                <BottomIcon name={item.icon} />
                {item.to === "/cart" && itemCount > 0 ? (
                  <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-ink px-1.5 py-0.5 text-[9px] font-bold text-white">
                    {itemCount}
                  </span>
                ) : null}
              </span>
              <span className="mt-1">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
