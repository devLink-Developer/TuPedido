import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Clock3, PackageCheck, Store, Truck } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuthSession } from "../../../shared/hooks";
import { fetchOrders } from "../../../shared/services/api";
import type { Order } from "../../../shared/types";
import { statusLabels } from "../../../shared/utils/labels";
import { isActiveCustomerOrder, sortOrdersByNewest } from "../orders";

const ACTIVE_ORDER_REFRESH_INTERVAL_MS = 15000;

function formatDeliveryModeLabel(order: Order) {
  return order.delivery_mode === "delivery" ? "Envio" : "Retiro";
}

function getOrderStep(order: Order) {
  const steps =
    order.delivery_mode === "pickup"
      ? ["created", "accepted", "preparing", "ready_for_pickup", "delivered"]
      : ["created", "accepted", "preparing", "ready_for_dispatch", "out_for_delivery", "delivered"];
  const currentIndex = Math.max(0, steps.indexOf(order.status));
  return {
    current: currentIndex >= 0 ? currentIndex + 1 : 1,
    total: steps.length,
    progress: `${Math.max(12, Math.round((currentIndex / Math.max(1, steps.length - 1)) * 100))}%`
  };
}

function getOrderCue(order: Order) {
  if (order.status === "out_for_delivery") {
    return { icon: Truck, label: "En camino" };
  }
  if (order.status === "ready_for_dispatch" || order.status === "ready_for_pickup") {
    return { icon: PackageCheck, label: "Listo" };
  }
  if (order.status === "preparing") {
    return { icon: Clock3, label: "Preparando" };
  }
  return { icon: Store, label: "En comercio" };
}

export function ActiveOrderBar() {
  const location = useLocation();
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

  if (!featuredOrder) {
    return null;
  }

  const step = getOrderStep(featuredOrder);
  const cue = getOrderCue(featuredOrder);
  const CueIcon = cue.icon;
  const statusLabel = statusLabels[featuredOrder.status] ?? featuredOrder.status;

  return (
    <section className="sticky top-[7.1rem] z-20 mb-6 md:top-28">
      <div className="app-panel border-brand-100 bg-[linear-gradient(135deg,#fff7f2_0%,#fffdfb_100%)] p-3 sm:p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="grid min-w-0 gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-[18px] border border-brand-100 bg-white text-brand-600 shadow-sm">
              <CueIcon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-600">Pedido en curso</p>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-zinc-600">#{featuredOrder.id}</span>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-zinc-600">{statusLabel}</span>
              </div>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-black tracking-tight text-ink">{featuredOrder.store_name}</h2>
                  <p className="mt-1 text-sm text-zinc-600">
                    {cue.label} - {formatDeliveryModeLabel(featuredOrder)}
                    {featuredOrder.eta_minutes ? ` - ETA ${featuredOrder.eta_minutes} min` : ""}
                  </p>
                </div>
                <p className="text-xs font-semibold text-zinc-500">
                  Paso {step.current} de {step.total}
                </p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-[linear-gradient(90deg,#ff7b23,#ff6414)] transition-[width] duration-300" style={{ width: step.progress }} />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/c/pedido/${featuredOrder.id}`}
              className="app-button min-h-[44px] px-4 py-2 text-sm"
            >
              Seguir pedido
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            {additionalActiveOrders ? (
              <Link
                to="/c/pedidos"
                className="inline-flex min-h-[44px] items-center rounded-[18px] border border-[var(--color-border-default)] bg-white px-4 py-2 text-sm font-bold text-zinc-700 transition hover:border-brand-100 hover:text-ink"
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
