import { useEffect, useState } from "react";
import { EmptyState, LoadingCard, PageHeader } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import { fetchMerchantOrders, updateMerchantOrderStatus } from "../../../shared/services/api";
import type { Order } from "../../../shared/types";
import { orderStatusOptions } from "../../../shared/utils/labels";
import { OrdersTable } from "../components/OrdersTable";

export function OrdersPage() {
  const { token } = useAuthSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setOrders(await fetchMerchantOrders(token));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudieron cargar los pedidos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  async function handleUpdateStatus(orderId: number, status: (typeof orderStatusOptions)[number]) {
    if (!token) return;
    await updateMerchantOrderStatus(token, orderId, { status });
    await load();
  }

  if (loading) return <LoadingCard />;
  if (error) return <EmptyState title="Pedidos no disponibles" description={error} />;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Comercio" title="Pedidos" description="Gestión diaria de estados operativos del comercio." />
      {orders.length ? (
        <OrdersTable orders={orders} onUpdateStatus={handleUpdateStatus} />
      ) : (
        <EmptyState title="Sin pedidos" description="Los pedidos del comercio aparecerán aquí." />
      )}
    </div>
  );
}
