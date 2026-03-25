import { useEffect, useState } from "react";
import { EmptyState, LoadingCard, PageHeader } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import { fetchAdminOrders } from "../../../shared/services/api";
import type { Order } from "../../../shared/types";
import { formatCurrency, formatDateTime } from "../../../shared/utils/format";
import { paymentMethodLabels, statusLabels } from "../../../shared/utils/labels";

export function OrdersPage() {
  const { token } = useAuthSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetchAdminOrders(token)
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
      <PageHeader eyebrow="Admin" title="Pedidos" description="Vista central de pedidos y estados de la plataforma." />
      <div className="space-y-4">
        {orders.map((order) => (
          <article key={order.id} className="rounded-[28px] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">{order.store_name}</h3>
                <p className="text-sm text-zinc-600">{order.customer_name} · {formatDateTime(order.created_at)}</p>
              </div>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">{statusLabels[order.status] ?? order.status}</span>
            </div>
            <div className="mt-3 grid gap-2 text-sm text-zinc-600 md:grid-cols-4">
              <p>{paymentMethodLabels[order.payment_method]}</p>
              <p>Total: {formatCurrency(order.pricing.total)}</p>
              <p>Pago: {statusLabels[order.payment_status] ?? order.payment_status}</p>
              <p>Delivery: {statusLabels[order.delivery_status] ?? order.delivery_status}</p>
            </div>
          </article>
        ))}
        {!orders.length ? <EmptyState title="Sin pedidos" description="Todavía no hay pedidos registrados." /> : null}
      </div>
    </div>
  );
}
