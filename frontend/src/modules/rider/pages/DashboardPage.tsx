import { useEffect, useMemo, useState } from "react";
import { EmptyState, LoadingCard, PageHeader } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import {
  acceptDeliveryOrder,
  deliverDeliveryOrder,
  fetchDeliveryMe,
  fetchDeliveryNotifications,
  fetchDeliveryOrders,
  fetchDeliverySettlements,
  pickupDeliveryOrder,
  pushDeliveryLocation,
  updateDeliveryAvailability
} from "../../../shared/services/api";
import type { DeliveryProfile, DeliverySettlement, Order } from "../../../shared/types";
import { statusLabels } from "../../../shared/utils/labels";
import { ActiveDelivery } from "../components/ActiveDelivery";
import { AvailableOrders } from "../components/AvailableOrders";
import { EarningsSummary } from "../components/EarningsSummary";
import { OnlineToggle } from "../components/OnlineToggle";

export function DashboardPage() {
  const { token } = useAuthSession();
  const [profile, setProfile] = useState<DeliveryProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [settlement, setSettlement] = useState<DeliverySettlement | null>(null);
  const [notifications, setNotifications] = useState<Array<{ id: number; title: string; body: string; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<number | null>(null);

  async function load() {
    if (!token) return;
    setLoading(true);
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
      setError(requestError instanceof Error ? requestError.message : "No se pudo cargar el panel rider");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  const activeOrder = useMemo(
    () =>
      orders.find((order) =>
        ["assignment_pending", "assigned", "heading_to_store", "picked_up", "near_customer"].includes(order.delivery_status)
      ) ?? null,
    [orders]
  );

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
          setOrders((current) => current.map((order) => (order.id === updated.id ? updated : order)));
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

  async function handleAccept(orderId: number) {
    if (!token) return;
    setBusyOrderId(orderId);
    try {
      const updated = await acceptDeliveryOrder(token, orderId);
      setOrders((current) => current.map((order) => (order.id === updated.id ? updated : order)));
    } finally {
      setBusyOrderId(null);
    }
  }

  async function handlePickup(orderId: number) {
    if (!token) return;
    setBusyOrderId(orderId);
    try {
      const updated = await pickupDeliveryOrder(token, orderId);
      setOrders((current) => current.map((order) => (order.id === updated.id ? updated : order)));
    } finally {
      setBusyOrderId(null);
    }
  }

  async function handleDeliver(orderId: number, otp: string) {
    if (!token) return;
    setBusyOrderId(orderId);
    try {
      const updated = await deliverDeliveryOrder(token, orderId, otp);
      setOrders((current) => current.map((order) => (order.id === updated.id ? updated : order)));
    } finally {
      setBusyOrderId(null);
    }
  }

  if (loading) return <LoadingCard label="Cargando operación de rider..." />;
  if (error) return <EmptyState title="No se pudo abrir el panel" description={error} />;
  if (!profile || !settlement) return <EmptyState title="Perfil incompleto" description="Tu alta rider todavía no está disponible." />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Rider"
        title="Operación de reparto"
        description="Disponibilidad, pedidos activos, tracking y resumen de ganancias."
        action={<OnlineToggle value={profile.availability} onChange={changeAvailability} />}
      />

      <EarningsSummary settlement={settlement} />

      {activeOrder ? (
        <ActiveDelivery
          order={activeOrder}
          onAccept={() => handleAccept(activeOrder.id)}
          onPickup={() => handlePickup(activeOrder.id)}
          onDeliver={(otp) => handleDeliver(activeOrder.id, otp)}
          loading={busyOrderId === activeOrder.id}
        />
      ) : (
        <EmptyState title="Sin pedido activo" description="Cuando haya una asignación o viaje en curso aparecerá aquí." />
      )}

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <AvailableOrders orders={orders} />
        <div className="rounded-[28px] bg-white p-5 shadow-sm">
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
