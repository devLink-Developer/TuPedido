import type { Order } from "../../../shared/types";
import { Button } from "../../../shared/ui/Button";
import { formatCurrency, formatDateTime } from "../../../shared/utils/format";
import { orderStatusOptions, paymentMethodLabels, statusLabels } from "../../../shared/utils/labels";

export function OrdersTable({
  orders,
  onUpdateStatus
}: {
  orders: Order[];
  onUpdateStatus: (orderId: number, status: (typeof orderStatusOptions)[number]) => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <article key={order.id} className="rounded-[28px] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold">Pedido #{order.id}</h3>
              <p className="text-sm text-zinc-600">{order.customer_name} · {formatDateTime(order.created_at)}</p>
            </div>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
              {statusLabels[order.status] ?? order.status}
            </span>
          </div>
          <div className="mt-3 grid gap-2 text-sm text-zinc-600 md:grid-cols-6">
            <p>Pago: {paymentMethodLabels[order.payment_method]}</p>
            <p>Total cliente: {formatCurrency(order.pricing.total)}</p>
            <p>Neto comercio: {formatCurrency(order.total - order.service_fee)}</p>
            <p>Delivery cliente: {formatCurrency(order.delivery_fee_customer)}</p>
            <p>Fee plataforma: {formatCurrency(order.pricing.serviceFee)}</p>
            <p>Delivery: {statusLabels[order.delivery_status] ?? order.delivery_status}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {orderStatusOptions.map((status) => (
              <Button key={status} type="button" className="bg-zinc-900 px-3 py-2 text-xs" onClick={() => void onUpdateStatus(order.id, status)}>
                {statusLabels[status] ?? status}
              </Button>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
