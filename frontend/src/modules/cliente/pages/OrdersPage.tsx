import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, LoadingCard, PageHeader, StatusPill } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import { fetchOrders } from "../../../shared/services/api";
import type { Order } from "../../../shared/types";
import { formatCurrency, formatDateTime } from "../../../shared/utils/format";
import { paymentMethodLabels, statusLabels } from "../../../shared/utils/labels";
import { sortOrdersByNewest } from "../orders";

function formatDeliveryModeLabel(order: Order) {
  return order.delivery_mode === "delivery" ? "Envio" : "Retiro";
}

export function OrdersPage() {
  const { token } = useAuthSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setOrders([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchOrders(token)
      .then((items) => {
        if (!cancelled) {
          setOrders([...items].sort(sortOrdersByNewest));
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "No se pudieron cargar tus pedidos");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cliente"
        title="Mis pedidos"
        description="Revisa tus compras activas, entregadas y canceladas desde un solo lugar."
      />

      {loading ? <LoadingCard /> : null}
      {error ? <EmptyState title="No se pudieron cargar tus pedidos" description={error} /> : null}

      {!loading && !error ? (
        orders.length ? (
          <div className="space-y-4">
            {orders.map((order) => (
              <Link
                key={order.id}
                to={`/c/pedido/${order.id}`}
                className="block rounded-[28px] bg-white p-5 shadow-sm transition hover:-translate-y-0.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Pedido #{order.id}</p>
                    <h2 className="mt-2 truncate text-xl font-bold text-ink">{order.store_name}</h2>
                    <p className="mt-1 text-sm text-zinc-500">{formatDateTime(order.created_at)}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <StatusPill value={order.status} />
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
                      {paymentMethodLabels[order.payment_method]}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-600">
                  <span>{formatDeliveryModeLabel(order)}</span>
                  <span>{statusLabels[order.payment_status] ?? order.payment_status}</span>
                  <span className="font-semibold text-ink">{formatCurrency(order.total)}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Todavia no tienes pedidos"
            description="Cuando confirmes una compra aparecera aqui para volver al tracking cuando lo necesites."
          />
        )
      ) : null}
    </div>
  );
}
