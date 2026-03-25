import { useEffect, useState } from "react";
import { EmptyState, LoadingCard, PageHeader } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import { fetchDeliveryOrders } from "../../../shared/services/api";
import type { Order } from "../../../shared/types";
import { AvailableOrders } from "../components/AvailableOrders";

export function HistoryPage() {
  const { token } = useAuthSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetchDeliveryOrders(token)
      .then((items) => setOrders(items.filter((order) => ["delivered", "cancelled", "delivery_failed"].includes(order.status))))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <LoadingCard />;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Rider" title="Historial" description="Pedidos cerrados y viajes ya resueltos." />
      {orders.length ? <AvailableOrders orders={orders} /> : <EmptyState title="Sin historial" description="Cuando cierres viajes aparecerán aquí." />}
    </div>
  );
}
