import { useEffect, useMemo, useState } from "react";
import { EmptyState, LoadingCard, PageHeader } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import {
  buildDeliverySocketUrl,
  deliverDeliveryOrder,
  fetchDeliveryMe,
  fetchDeliveryNotifications,
  fetchDeliveryOrders,
  fetchDeliverySettlements,
  pickupDeliveryOrder,
  pushDeliveryLocation,
  REALTIME_ENABLED,
  updateDeliveryAvailability
} from "../../../shared/services/api";
import type { AppNotification, DeliveryProfile, DeliverySettlement, Order } from "../../../shared/types";
import { statusLabels } from "../../../shared/utils/labels";
import { ActiveDelivery } from "../components/ActiveDelivery";
import { AvailableOrders } from "../components/AvailableOrders";
import { EarningsSummary } from "../components/EarningsSummary";
import { OnlineToggle } from "../components/OnlineToggle";

const LIVE_REFRESH_INTERVAL_MS = 15000;

function upsertOrderList(current: Order[], nextOrder: Order) {
  const existing = current.some((order) => order.id === nextOrder.id);
  const next = existing ? current.map((order) => (order.id === nextOrder.id ? nextOrder : order)) : [nextOrder, ...current];
  return [...next].sort((left, right) => right.id - left.id);
}

function mergeNotifications(current: AppNotification[], incoming: AppNotification[]) {
  const byId = new Map<number, AppNotification>();
  for (const item of [...incoming, ...current]) {
    byId.set(item.id, item);
  }
  return [...byId.values()].sort((left, right) => (left.created_at < right.created_at ? 1 : -1));
}

export function DashboardPage() {
  const { token } = useAuthSession();
  const [profile, setProfile] = useState<DeliveryProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [settlement, setSettlement] = useState<DeliverySettlement | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<number | null>(null);

  async function load(options?: { silent?: boolean }) {
    if (!token) return;
    if (!options?.silent) {
      setLoading(true);
    }
    try {
      const [profileData, orderList, settlementData, notificationList] = await Promise.all([
        fetchDeliveryMe(token),
        fetchDeliveryOrders(token),
        fetchDeliverySettlements(token),
        fetchDeliveryNotifications(token)
      ]);
      setProfile(profileData);
      setOrders(orderList);
      setSettlement(settlementData);
      setNotifications(notificationList);
      setError(null);
    } catch (requestError) {
      if (!options?.silent) {
        setError(requestError instanceof Error ? requestError.message : "No se pudo cargar el panel rider");
      }
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  const activeOrder = useMemo(
    () => orders.find((order) => ["assigned", "heading_to_store", "picked_up", "near_customer"].includes(order.delivery_status)) ?? null,
    [orders]
  );

  useEffect(() => {
    if (!token || !REALTIME_ENABLED) return;

    let socket: WebSocket | null = null;
    try {
      socket = new WebSocket(buildDeliverySocketUrl(token));
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (Array.isArray(payload?.notifications)) {
            setNotifications((current) => mergeNotifications(current, payload.notifications as AppNotification[]));
          }
          if (payload?.order) {
            setOrders((current) => upsertOrderList(current, payload.order as Order));
          }
        } catch {
          // Keep HTTP state as fallback.
        }
      };
    } catch {
      return;
    }

    return () => {
      socket?.close();
    };
  }, [token]);

  useEffect(() => {
    if (!token) return;

    const refreshSilently = () => {
      void load({ silent: true });
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
  }, [token]);

  useEffect(() => {
    if (!token || !activeOrder || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        void pushDeliveryLocation(token, {
          order_id: activeOrder.id,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          heading: position.coords.heading ?? null,
          speed_kmh: position.coords.speed ? position.coords.speed * 3.6 : null,
          accuracy_meters: position.coords.accuracy
        }).then((updated) => {
          setOrders((current) => upsertOrderList(current, updated));
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [activeOrder, token]);

  async function changeAvailability(next: DeliveryProfile["availability"]) {
    if (!token || !profile) return;
    const nextProfile = await updateDeliveryAvailability(token, { availability: next, zone_id: profile.current_zone_id });
    setProfile(nextProfile);
  }

  async function handlePickup(orderId: number) {
    if (!token) return;
    setBusyOrderId(orderId);
    try {
      const updated = await pickupDeliveryOrder(token, orderId);
      setOrders((current) => upsertOrderList(current, updated));
    } finally {
      setBusyOrderId(null);
    }
  }

  async function handleDeliver(orderId: number, otp: string) {
    if (!token) return;
    setBusyOrderId(orderId);
    try {
      const updated = await deliverDeliveryOrder(token, orderId, otp);
      setOrders((current) => upsertOrderList(current, updated));
    } finally {
      setBusyOrderId(null);
    }
  }

  if (loading) return <LoadingCard label="Cargando operacion de rider..." />;
  if (error) return <EmptyState title="No se pudo abrir el panel" description={error} />;
  if (!profile || !settlement) return <EmptyState title="Perfil incompleto" description="Tu alta rider todavia no esta disponible." />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Rider"
        title="Operacion de reparto"
        description="Pedidos asignados y resumen de ganancias."
        action={<OnlineToggle value={profile.availability} onChange={changeAvailability} />}
      />

      <EarningsSummary settlement={settlement} />

      {activeOrder ? (
        <ActiveDelivery
          order={activeOrder}
          onPickup={() => handlePickup(activeOrder.id)}
          onDeliver={(otp) => handleDeliver(activeOrder.id, otp)}
          loading={busyOrderId === activeOrder.id}
        />
      ) : (
        <EmptyState title="Sin pedido activo" description="Cuando el comercio te asigne un pedido aparecera aqui." />
      )}

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <AvailableOrders orders={orders} />
        <div className="app-panel rounded-[28px] p-5">
          <h3 className="text-lg font-bold">Notificaciones</h3>
          <div className="mt-4 space-y-3">
            {notifications.map((notification) => (
              <div key={notification.id} className="rounded-2xl bg-zinc-50 p-4 text-sm">
                <p className="font-semibold">{notification.title}</p>
                <p className="mt-2 text-zinc-600">{notification.body}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-zinc-400">
                  {new Date(notification.created_at).toLocaleString("es-AR")}
                </p>
              </div>
            ))}
            {!notifications.length ? <p className="text-sm text-zinc-500">No hay notificaciones nuevas.</p> : null}
          </div>
          <div className="mt-5 rounded-[24px] bg-zinc-50 p-4 text-sm text-zinc-600">
            <p className="font-semibold text-ink">Estado actual</p>
            <p className="mt-2">{statusLabels[profile.availability] ?? profile.availability}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
