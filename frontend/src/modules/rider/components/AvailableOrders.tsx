import type { Order } from "../../../shared/types";
import { formatCurrency, formatDateTime } from "../../../shared/utils/format";
import { statusLabels } from "../../../shared/utils/labels";

export function AvailableOrders({ orders }: { orders: Order[] }) {
  return (
    <div className="space-y-3">
      {orders.map((order) => (
        <article key={order.id} className="rounded bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold">{order.store_name}</h3>
              <p className="text-sm text-zinc-600">{order.address_full ?? "Retiro en local"}</p>
            </div>
            <span className="rounded bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
              {statusLabels[order.delivery_status] ?? order.delivery_status}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-sm text-zinc-600">
            <span>Cliente: {formatCurrency(order.pricing.total)}</span>
            <span>Rider: {formatCurrency(order.rider_fee)}</span>
            <span>{formatDateTime(order.created_at)}</span>
          </div>
        </article>
      ))}
    </div>
  );
}
