import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { EmptyState, LoadingCard, PageHeader, StatusPill } from "../../../shared/components";
import { useAuthSession, useOrderLiveTracking } from "../../../shared/hooks";
import { fetchOrder, fetchOrderTracking } from "../../../shared/services/api";
import type { Order, OrderTracking as OrderTrackingType } from "../../../shared/types";
import { formatCurrency, formatDateTime } from "../../../shared/utils/format";
import { paymentMethodLabels, statusLabels } from "../../../shared/utils/labels";
import { CheckoutSummary } from "../components/CheckoutSummary";
import { OrderTracking } from "../components/OrderTracking";
import { isActiveCustomerOrder } from "../orders";

const LIVE_REFRESH_INTERVAL_MS = 15000;

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
  const { token } = useAuthSession();
  const [order, setOrder] = useState<Order | null>(null);
  const [tracking, setTracking] = useState<OrderTrackingType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const orderId = id ? Number(id) : null;
  const otpFetchRequestedRef = useRef<Set<number>>(new Set());

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
  const handleTrackingUpdate = useCallback((value: OrderTrackingType) => setTracking(value), []);

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

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Pedido" title={`Pedido #${order.id}`} description={`${order.store_name} · ${formatDateTime(order.created_at)}`} />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="rounded-[28px] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap gap-2">
              <StatusPill value={order.status} />
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">{paymentMethodLabels[order.payment_method]}</span>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">{order.delivery_mode === "delivery" ? "Envío" : "Retiro"}</span>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">{statusLabels[order.payment_status] ?? order.payment_status}</span>
            </div>
            <div className="mt-4 space-y-2 text-sm text-zinc-600">
              <p><strong>Cliente:</strong> {order.customer_name}</p>
              <p><strong>Dirección:</strong> {order.address_full ?? order.address_label ?? "Retiro en local"}</p>
              {order.payment_reference ? <p><strong>Referencia:</strong> {order.payment_reference}</p> : null}
            </div>
          </div>

          {liveTracking?.tracking_enabled ? <OrderTracking order={order} tracking={liveTracking} /> : null}

          <div className="rounded-[28px] bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold">Items</h3>
            <div className="mt-4 space-y-3">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-4 rounded-2xl bg-zinc-50 px-4 py-3 text-sm">
                  <div>
                    <p className="font-semibold">{item.product_name}</p>
                    <p className="text-zinc-500">{item.quantity} x {formatCurrency(item.unit_price)}</p>
                    {item.note ? <p className="text-zinc-500">{item.note}</p> : null}
                  </div>
                  <p className="font-bold">{formatCurrency(item.unit_price * item.quantity)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <CheckoutSummary pricing={order.pricing} title="Totales" />
          <div className="rounded-[28px] bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold">Estado operativo</h3>
            <div className="mt-4 space-y-2 text-sm text-zinc-600">
              <p>Pago: {statusLabels[order.payment_status] ?? order.payment_status}</p>
              <p>Delivery: {statusLabels[deliveryStatus] ?? deliveryStatus}</p>
              {assignedRiderName ? <p>Rider: {assignedRiderName}</p> : null}
              {etaMinutes !== null ? <p>ETA: {etaMinutes} min</p> : null}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
