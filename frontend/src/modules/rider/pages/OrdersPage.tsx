import { useEffect, useState } from "react";
import { EmptyState, LoadingCard, PageHeader } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import { fetchDeliveryOrders } from "../../../shared/services/api";
import type { Order } from "../../../shared/types";
import { AvailableOrders } from "../components/AvailableOrders";

export function OrdersPage() {
  const { token } = useAuthSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetchDeliveryOrders(token)
      .then((items) => {
        setOrders(items);
        setError(null);
      })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "No se pudieron cargar los pedidos"))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <LoadingCard />;
  if (error) return <EmptyState title="Pedidos no disponibles" description={error} />;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Rider" title="Pedidos" description="Asignaciones y entregas en curso." />
      {orders.length ? <AvailableOrders orders={orders} /> : <EmptyState title="Sin pedidos" description="Todavía no hay pedidos para mostrar." />}
    </div>
  );
}
