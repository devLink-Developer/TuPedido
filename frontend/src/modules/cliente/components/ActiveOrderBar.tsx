import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useMatch } from "react-router-dom";
import { useAuthSession } from "../../../shared/hooks";
import { fetchOrders } from "../../../shared/services/api";
import type { Order } from "../../../shared/types";
import { statusLabels } from "../../../shared/utils/labels";
import { isActiveCustomerOrder, sortOrdersByNewest } from "../orders";

const ACTIVE_ORDER_REFRESH_INTERVAL_MS = 15000;

function formatDeliveryModeLabel(order: Order) {
  return order.delivery_mode === "delivery" ? "Envio" : "Retiro";
}

export function ActiveOrderBar() {
  const location = useLocation();
  const currentOrderMatch = useMatch("/c/pedido/:id");
  const currentOrderId = currentOrderMatch?.params.id ? Number(currentOrderMatch.params.id) : null;
  const { isAuthenticated, token, user } = useAuthSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const hasLoadedRef = useRef(false);
  const isCustomer = isAuthenticated && user?.role === "customer" && Boolean(token);

  useEffect(() => {
    if (!isCustomer || !token) {
      hasLoadedRef.current = false;
      setOrders([]);
      return;
    }

    const authToken = token;
    let cancelled = false;

    async function loadOrders() {
      try {
        const items = await fetchOrders(authToken);
        if (!cancelled) {
          hasLoadedRef.current = true;
          setOrders([...items].sort(sortOrdersByNewest));
        }
      } catch {
        if (!cancelled && !hasLoadedRef.current) {
          setOrders([]);
        }
      }
    }

    void loadOrders();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadOrders();
      }
    }, ACTIVE_ORDER_REFRESH_INTERVAL_MS);

    const handleFocus = () => {
      void loadOrders();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadOrders();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isCustomer, location.hash, location.pathname, location.search, token]);

  const activeOrders = useMemo(
    () => orders.filter(isActiveCustomerOrder).sort(sortOrdersByNewest),
    [orders]
  );

  const featuredOrder = activeOrders[0] ?? null;
  const additionalActiveOrders = activeOrders.length > 1 ? activeOrders.length - 1 : 0;
  const isViewingFeaturedOrder = featuredOrder ? currentOrderId === featuredOrder.id : false;

  if (!featuredOrder) {
    return null;
  }

  return (
    <section className="sticky top-[5.5rem] z-20 mb-6">
      <div className="rounded-[28px] border border-brand-100 bg-[linear-gradient(135deg,#fff7f2_0%,#fffdfb_100%)] p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-600">Pedido en proceso</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-bold text-ink">{featuredOrder.store_name}</h2>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-600">
                #{featuredOrder.id}
              </span>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-600">
                {statusLabels[featuredOrder.status] ?? featuredOrder.status}
              </span>
            </div>
            <p className="mt-2 text-sm text-zinc-600">
              {formatDeliveryModeLabel(featuredOrder)}
              {featuredOrder.eta_minutes ? ` · ETA ${featuredOrder.eta_minutes} min` : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isViewingFeaturedOrder ? (
              <span className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">Tracking abierto</span>
            ) : (
              <Link
                to={`/c/pedido/${featuredOrder.id}`}
                className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm"
              >
                Ver tracking
              </Link>
            )}
            {additionalActiveOrders ? (
              <Link
                to="/c/pedidos"
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-zinc-700"
              >
                y {additionalActiveOrders} mas
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
