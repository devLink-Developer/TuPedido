import {
  CalendarDays,
  ChevronRight,
  CreditCard,
  MapPin,
  ReceiptText,
  RotateCcw,
  Store,
  Truck
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { EmptyState, LoadingCard, StatusPill } from "../../../shared/components";
import { useAuthSession, useCart, useOrderLiveTracking } from "../../../shared/hooks";
import { fetchOrder, fetchOrderTracking } from "../../../shared/services/api";
import { useUiStore } from "../../../shared/stores";
import type { Order, OrderTracking as OrderTrackingType } from "../../../shared/types";
import { dispatchOrderReviewPromptRefresh } from "../../../shared/utils/orderReviewPrompt";
import { formatCurrency, formatDateTime } from "../../../shared/utils/format";
import { paymentMethodLabels, statusLabels } from "../../../shared/utils/labels";
import { CheckoutSummary } from "../components/CheckoutSummary";
import { OrderTracking } from "../components/OrderTracking";
import { isActiveCustomerOrder } from "../orders";
import { repeatOrderIntoCart, repeatOrderMessage } from "../repeatOrder";

const LIVE_REFRESH_INTERVAL_MS = 15000;

function formatDeliveryModeLabel(order: Order) {
  return order.delivery_mode === "delivery" ? "Envio" : "Retiro";
}

function getOrderItemCount(order: Order) {
  return order.items.reduce((total, item) => total + item.quantity, 0);
}

function getStatusTone(status: string) {
  if (status === "delivered") {
    return {
      background: "bg-[linear-gradient(135deg,#f0fdf4_0%,#ffffff_100%)]",
      border: "border-emerald-200",
      eyebrow: "text-emerald-700",
      badge: "bg-emerald-100 text-emerald-800"
    };
  }

  if (status === "cancelled" || status === "delivery_failed") {
    return {
      background: "bg-[linear-gradient(135deg,#fff1f2_0%,#ffffff_100%)]",
      border: "border-rose-200",
      eyebrow: "text-rose-700",
      badge: "bg-rose-100 text-rose-700"
    };
  }

  return {
    background: "bg-[linear-gradient(135deg,#fff7f2_0%,#fffdfb_100%)]",
    border: "border-brand-100",
    eyebrow: "text-brand-600",
    badge: "bg-brand-100 text-brand-700"
  };
}

function getOrderStatusSummary(order: Order, deliveryStatus: string | null, etaMinutes: number | null) {
  switch (order.status) {
    case "created":
      return "Recibimos tu pedido y estamos esperando la confirmacion del comercio.";
    case "accepted":
      return order.delivery_mode === "delivery"
        ? "El comercio ya acepto tu pedido y esta por empezar a prepararlo."
        : "El comercio ya acepto tu pedido y esta por prepararlo para retiro.";
    case "preparing":
      return order.delivery_mode === "delivery"
        ? "El comercio esta preparando tu pedido."
        : "El comercio esta preparando tu pedido para retiro.";
    case "ready_for_dispatch":
      return deliveryStatus === "assigned" || deliveryStatus === "heading_to_store"
        ? "Tu pedido ya esta listo y el rider va camino al comercio."
        : "Tu pedido ya esta listo para salir a entrega.";
    case "ready_for_pickup":
      return "Tu pedido ya esta listo para retirar en el local.";
    case "out_for_delivery":
      return etaMinutes !== null
        ? `Tu pedido va en camino. ETA estimado: ${etaMinutes} min.`
        : "Tu pedido va en camino a la direccion de entrega.";
    case "delivered":
      return "El pedido ya fue entregado y quedo en tu historial.";
    case "cancelled":
      return "El pedido fue cancelado.";
    case "delivery_failed":
      return "No se pudo completar la entrega.";
    default:
      return "Seguimos actualizando el estado de tu pedido.";
  }
}

function getDeliverySummary(
  order: Order,
  deliveryStatusLabel: string,
  assignedRiderName: string | null,
  etaMinutes: number | null
) {
  if (order.delivery_mode === "pickup") {
    return {
      title: order.status === "ready_for_pickup" ? "Listo para retirar" : "Retiro en local",
      description:
        order.status === "ready_for_pickup"
          ? "Puedes acercarte al comercio cuando quieras."
          : "Te avisaremos cuando quede listo para retiro."
    };
  }

  if (assignedRiderName) {
    return {
      title: assignedRiderName,
      description: etaMinutes !== null ? `ETA ${etaMinutes} min - ${deliveryStatusLabel}` : `Repartidor asignado - ${deliveryStatusLabel}`
    };
  }

  return {
    title: deliveryStatusLabel,
    description: etaMinutes !== null ? `ETA ${etaMinutes} min` : "Aun sin repartidor asignado"
  };
}

async function loadOrderSnapshot(token: string, orderId: number) {
  const order = await fetchOrder(token, orderId);

  if (!isActiveCustomerOrder(order)) {
    return { order, tracking: null };
  }

  try {
    const tracking = await fetchOrderTracking(token, orderId);
    return { order, tracking };
  } catch {
    return { order, tracking: null };
  }
}

export function OrderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuthSession();
  const { addItem, setDeliveryMode } = useCart();
  const enqueueToast = useUiStore((state) => state.enqueueToast);
  const [order, setOrder] = useState<Order | null>(null);
  const [tracking, setTracking] = useState<OrderTrackingType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [repeating, setRepeating] = useState(false);
  const orderId = id ? Number(id) : null;
  const otpFetchRequestedRef = useRef<Set<number>>(new Set());
  const previousOrderStatusRef = useRef<string | null>(null);

  useEffect(() => {
    if (!token || !orderId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setOrder(null);
    setTracking(null);

    loadOrderSnapshot(token, orderId)
      .then(({ order: nextOrder, tracking: nextTracking }) => {
        if (cancelled) return;
        setOrder(nextOrder);
        setTracking(nextTracking);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "No se pudo cargar el pedido");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [orderId, token]);

  const isActiveOrder = Boolean(order && isActiveCustomerOrder(order));

  const handleOrderUpdate = useCallback((value: Order) => {
    setOrder(value);
    if (!isActiveCustomerOrder(value)) {
      setTracking(null);
    }
  }, []);

  const handleTrackingUpdate = useCallback((value: OrderTrackingType) => {
    setTracking(value);
  }, []);

  useOrderLiveTracking({
    token,
    orderId,
    enabled: Boolean(orderId && token && isActiveOrder),
    onOrder: handleOrderUpdate,
    onTracking: handleTrackingUpdate
  });

  useEffect(() => {
    if (!token || !orderId) {
      return;
    }

    const refreshSilently = () => {
      void loadOrderSnapshot(token, orderId)
        .then(({ order: nextOrder, tracking: nextTracking }) => {
          setOrder(nextOrder);
          setTracking(nextTracking);
        })
        .catch(() => {
          // Keep the current detail visible on transient refresh failures.
        });
    };

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshSilently();
      }
    }, LIVE_REFRESH_INTERVAL_MS);

    const handleFocus = () => {
      refreshSilently();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshSilently();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [orderId, token]);

  useEffect(() => {
    if (!token || !order || !isActiveCustomerOrder(order) || !order.otp_required || !order.assigned_rider_id) {
      return;
    }

    if (tracking?.otp_code || otpFetchRequestedRef.current.has(order.id)) {
      return;
    }

    otpFetchRequestedRef.current.add(order.id);

    void fetchOrderTracking(token, order.id)
      .then((value) => setTracking(value))
      .catch(() => {
        otpFetchRequestedRef.current.delete(order.id);
      });
  }, [order, token, tracking]);

  useEffect(() => {
    if (!order) {
      previousOrderStatusRef.current = null;
      return;
    }

    const previousStatus = previousOrderStatusRef.current;
    previousOrderStatusRef.current = order.status;

    if (order.status === "delivered" && previousStatus !== null && previousStatus !== "delivered") {
      dispatchOrderReviewPromptRefresh();
    }
  }, [order]);

  const liveTracking = useMemo(() => {
    if (!order || !isActiveCustomerOrder(order)) return null;

    return (
      tracking ?? {
        order_id: order.id,
        status: order.status,
        delivery_status: order.delivery_status,
        delivery_provider: order.delivery_provider,
        tracking_enabled: order.delivery_provider === "platform",
        assigned_rider_id: order.assigned_rider_id,
        assigned_rider_name: order.assigned_rider_name,
        assigned_rider_phone_masked: order.assigned_rider_phone_masked,
        assigned_rider_vehicle_type: order.assigned_rider_vehicle_type,
        store_latitude: order.store_latitude,
        store_longitude: order.store_longitude,
        address_latitude: order.address_latitude,
        address_longitude: order.address_longitude,
        tracking_last_latitude: order.tracking_last_latitude,
        tracking_last_longitude: order.tracking_last_longitude,
        tracking_last_at: order.tracking_last_at,
        tracking_stale: order.tracking_stale,
        eta_minutes: order.eta_minutes,
        otp_required: order.otp_required,
        otp_code: null
      }
    );
  }, [order, tracking]);

  if (loading) return <LoadingCard />;
  if (error) return <EmptyState title="Pedido no disponible" description={error} />;
  if (!order) return <EmptyState title="Pedido inexistente" description="No encontramos ese pedido." />;

  const deliveryStatus = liveTracking?.delivery_status ?? order.delivery_status;
  const assignedRiderName = liveTracking?.assigned_rider_name ?? order.assigned_rider_name;
  const etaMinutes = liveTracking?.eta_minutes ?? order.eta_minutes;
  const statusLabel = statusLabels[order.status] ?? order.status;
  const paymentStatusLabel = statusLabels[order.payment_status] ?? order.payment_status;
  const deliveryStatusLabel = statusLabels[deliveryStatus] ?? deliveryStatus;
  const trackingAvailabilityLabel = !isActiveOrder
    ? "Pedido finalizado"
    : liveTracking?.tracking_enabled
      ? "Seguimiento activo"
      : "Pedido activo";
  const statusTone = getStatusTone(order.status);
  const deliverySummary = getDeliverySummary(order, deliveryStatusLabel, assignedRiderName, etaMinutes);
  const itemCount = getOrderItemCount(order);

  async function repeatCurrentOrder() {
    if (!order) return;

    setRepeating(true);
    try {
      const result = await repeatOrderIntoCart(order, { addItem, setDeliveryMode });
      enqueueToast(repeatOrderMessage(result), { durationMs: result.addedItemCount > 0 ? 4200 : 5200 });
      if (result.addedItemCount > 0) {
        navigate("/c/carrito");
      }
    } finally {
      setRepeating(false);
    }
  }

  return (
    <div className="space-y-5 pb-24">
      <section className={`overflow-hidden rounded border ${statusTone.border} ${statusTone.background} shadow-sm`}>
        <div className="border-b border-white/70 bg-white/50 px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-sm font-extrabold text-[var(--kp-ink-strong)]">Pedido #{order.id}</h1>
            <span className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full bg-white px-3 text-xs font-bold text-[var(--kp-ink-soft)]">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              {formatDateTime(order.created_at)}
            </span>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
            <p className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${statusTone.eyebrow}`}>
              Estado del pedido
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h2 className="font-display text-[1.85rem] font-bold leading-[1.08] tracking-tight text-ink sm:text-3xl">
                {statusLabel}
              </h2>
              <span className={`rounded px-3 py-1 text-xs font-semibold ${statusTone.badge}`}>
                {trackingAvailabilityLabel}
              </span>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-700 sm:leading-7">
              {getOrderStatusSummary(order, deliveryStatus, etaMinutes)}
            </p>
          </div>

            <div className="flex flex-wrap gap-2">
              <span className="rounded bg-white px-3 py-1 text-xs font-semibold text-zinc-600">
              {formatDeliveryModeLabel(order)}
              </span>
              <span className="rounded bg-white px-3 py-1 text-xs font-semibold text-zinc-600">
              {paymentStatusLabel}
              </span>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded bg-white/90 px-4 py-3 text-sm text-zinc-600">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Total</p>
              <p className="mt-2 text-lg font-black text-ink">{formatCurrency(order.total)}</p>
              <p className="mt-1">
                {itemCount} {itemCount === 1 ? "producto" : "productos"}
              </p>
            </div>
            <div className="rounded bg-white/90 px-4 py-3 text-sm text-zinc-600">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Entrega</p>
              <p className="mt-2 font-semibold text-ink">{deliverySummary.title}</p>
              <p className="mt-1">{deliverySummary.description}</p>
            </div>
            <div className="rounded bg-white/90 px-4 py-3 text-sm text-zinc-600">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Seguimiento</p>
              <p className="mt-2 font-semibold text-ink">{trackingAvailabilityLabel}</p>
              <p className="mt-1">
                {liveTracking?.tracking_enabled
                  ? "Seguimos mostrando la ubicacion del pedido en tiempo real."
                  : isActiveOrder
                    ? "Veras aqui el estado del pedido mientras siga en curso."
                    : "El seguimiento en vivo ya no esta disponible para este pedido."}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="kp-client-panel overflow-hidden">
        <div className="grid gap-0 md:grid-cols-[1fr_auto] md:items-center">
          <div className="flex min-w-0 gap-4 p-4 sm:p-5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded bg-[var(--kp-accent-soft)] text-[var(--kp-accent)]">
              <Store className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[var(--kp-ink-muted)]">Tienda</p>
              <h2 className="mt-1 truncate text-xl font-black tracking-tight text-[var(--kp-ink-strong)]">
                {order.store_name}
              </h2>
              <p className="mt-1 text-sm font-semibold text-[var(--kp-ink-soft)]">
                {formatDeliveryModeLabel(order)} · {paymentMethodLabels[order.payment_method]}
              </p>
            </div>
          </div>
          <div className="border-t border-[var(--kp-stroke)] p-4 md:border-l md:border-t-0 sm:p-5">
            <button
              type="button"
              onClick={() => void repeatCurrentOrder()}
              disabled={repeating}
              className="app-button min-h-[48px] w-full px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              {repeating ? "Actualizando precios" : "Repetir pedido"}
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
        <div className="space-y-4">
          {liveTracking?.tracking_enabled ? <OrderTracking order={order} tracking={liveTracking} /> : null}

          <section className="kp-client-panel p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[var(--kp-ink-muted)]">Productos</p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-[var(--kp-ink-strong)]">Tu pedido</h2>
              </div>
              <span className="inline-flex min-h-[32px] items-center rounded-full bg-[var(--kp-surface-muted)] px-3 text-xs font-bold text-[var(--kp-ink-soft)]">
                {itemCount} {itemCount === 1 ? "item" : "items"}
              </span>
            </div>
            <div className="mt-4 divide-y divide-[var(--kp-stroke)]">
              {order.items.map((item) => (
                <div key={item.id} className="grid grid-cols-[1fr_auto] gap-4 py-4 text-sm first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="font-extrabold text-[var(--kp-ink-strong)]">{item.product_name}</p>
                    <p className="mt-1 text-[var(--kp-ink-soft)]">
                      {item.quantity} x {formatCurrency(item.unit_price)}
                    </p>
                    {item.note ? <p className="mt-1 text-[var(--kp-ink-soft)]">{item.note}</p> : null}
                  </div>
                  <p className="whitespace-nowrap font-black text-[var(--kp-ink-strong)]">
                    {formatCurrency(item.unit_price * item.quantity)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="kp-client-panel p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded bg-[var(--kp-surface-muted)] text-[var(--kp-ink-soft)]">
                <MapPin className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[var(--kp-ink-muted)]">
                  Detalles sobre la entrega
                </p>
                <h2 className="mt-1 text-lg font-black tracking-tight text-[var(--kp-ink-strong)]">
                  {order.address_full ?? order.address_label ?? "Retiro en local"}
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusPill value={order.status} />
                  <span className="rounded bg-[var(--kp-surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--kp-ink-soft)]">
                    {deliveryStatusLabel}
                  </span>
                </div>
                {assignedRiderName ? (
                  <p className="mt-3 text-sm text-[var(--kp-ink-soft)]">Repartidor: {assignedRiderName}</p>
                ) : null}
                {etaMinutes !== null ? (
                  <p className="mt-1 text-sm text-[var(--kp-ink-soft)]">ETA: {etaMinutes} min</p>
                ) : null}
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <CheckoutSummary pricing={order.pricing} title="Totales" />

          <section className="kp-client-panel p-4 sm:p-5">
            <h2 className="text-lg font-black tracking-tight text-[var(--kp-ink-strong)]">Entrega y pago</h2>
            <div className="mt-4 space-y-4">
              <div className="flex gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded bg-[var(--kp-accent-soft)] text-[var(--kp-accent)]">
                  <ReceiptText className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[var(--kp-ink-muted)]">Tu pago</p>
                  <p className="mt-1 font-bold text-[var(--kp-ink-strong)]">{paymentStatusLabel}</p>
                  {order.payment_reference ? (
                    <p className="mt-1 break-words text-sm text-[var(--kp-ink-soft)]">Referencia: {order.payment_reference}</p>
                  ) : null}
                </div>
              </div>

              <div className="flex gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded bg-[var(--kp-surface-muted)] text-[var(--kp-ink-soft)]">
                  <CreditCard className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[var(--kp-ink-muted)]">
                    Medios de pago
                  </p>
                  <p className="mt-1 font-bold text-[var(--kp-ink-strong)]">
                    {paymentMethodLabels[order.payment_method]}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded bg-[var(--kp-surface-muted)] text-[var(--kp-ink-soft)]">
                  <Truck className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[var(--kp-ink-muted)]">
                    Detalles sobre la entrega
                  </p>
                  <p className="mt-1 font-bold text-[var(--kp-ink-strong)]">{deliverySummary.title}</p>
                  <p className="mt-1 text-sm leading-6 text-[var(--kp-ink-soft)]">{deliverySummary.description}</p>
                </div>
              </div>
            </div>
            <Link
              to={`/c/tienda/${order.store_id}`}
              className="mt-5 flex min-h-[48px] items-center justify-between rounded border border-[var(--kp-stroke)] bg-white px-4 text-sm font-extrabold text-[var(--kp-ink-strong)] transition hover:border-[rgba(255,106,26,0.28)] hover:bg-[#fffaf5]"
            >
              Ver tienda
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
