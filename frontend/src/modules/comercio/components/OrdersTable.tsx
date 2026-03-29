import { useEffect, useState } from "react";
import type { DeliveryProfile, Order, OrderStatusUpdate } from "../../../shared/types";
import { Button } from "../../../shared/ui/Button";
import { formatCurrency, formatDateTime } from "../../../shared/utils/format";
import { paymentMethodLabels, statusLabels } from "../../../shared/utils/labels";

type MerchantOrderAction = Extract<
  OrderStatusUpdate["status"],
  "preparing" | "ready_for_dispatch" | "ready_for_pickup" | "delivered" | "cancelled"
>;

function requiresPaymentApproval(order: Order) {
  return order.payment_method === "mercadopago" && order.payment_status !== "approved";
}

function canCancelOrder(order: Order) {
  if (["delivered", "cancelled", "delivery_failed"].includes(order.status)) {
    return false;
  }
  if (["picked_up", "near_customer", "delivered"].includes(order.delivery_status)) {
    return false;
  }
  return true;
}

function canAssignRider(order: Order) {
  if (order.delivery_mode !== "delivery") {
    return false;
  }
  if (["cancelled", "delivered", "delivery_failed"].includes(order.status)) {
    return false;
  }
  return (
    order.status === "ready_for_dispatch" ||
    ["assignment_pending", "assigned", "heading_to_store"].includes(order.delivery_status)
  );
}

export function OrdersTable({
  orders,
  riders,
  busyActionKey,
  onAssignRider,
  onUpdateStatus
}: {
  orders: Order[];
  riders: DeliveryProfile[];
  busyActionKey: string | null;
  onAssignRider: (orderId: number, riderUserId: number) => Promise<void>;
  onUpdateStatus: (orderId: number, status: MerchantOrderAction) => Promise<void>;
}) {
  const [selectedRiders, setSelectedRiders] = useState<Record<number, string>>({});

  useEffect(() => {
    setSelectedRiders((current) => {
      const next = { ...current };

      for (const order of orders) {
        const availableRiders = riders.filter(
          (rider) => rider.is_active && (rider.availability === "idle" || rider.user_id === order.assigned_rider_id)
        );
        const currentValue = next[order.id];
        const defaultValue = String(order.assigned_rider_id ?? availableRiders[0]?.user_id ?? "");
        const isCurrentValid = availableRiders.some((rider) => String(rider.user_id) === currentValue);
        if (!currentValue || !isCurrentValid) {
          next[order.id] = defaultValue;
        }
      }

      return next;
    });
  }, [orders, riders]);

  return (
    <div className="space-y-4">
      {orders.map((order) => {
        const assignmentRiders = riders.filter(
          (rider) => rider.is_active && (rider.availability === "idle" || rider.user_id === order.assigned_rider_id)
        );
        const selectedRiderValue = selectedRiders[order.id] ?? "";
        const assignBusy = busyActionKey === `${order.id}:assign`;
        const paymentBlocked = requiresPaymentApproval(order);

        return (
          <article key={order.id} className="rounded-[28px] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">Pedido #{order.id}</h3>
                <p className="text-sm text-zinc-600">
                  {order.customer_name} | {formatDateTime(order.created_at)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
                  {order.delivery_mode === "delivery" ? "Envio" : "Retiro"}
                </span>
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
                  {statusLabels[order.status] ?? order.status}
                </span>
              </div>
            </div>

            <div className="mt-3 grid gap-2 text-sm text-zinc-600 md:grid-cols-2 xl:grid-cols-4">
              <p>Pago: {paymentMethodLabels[order.payment_method]}</p>
              <p>Estado pago: {statusLabels[order.payment_status] ?? order.payment_status}</p>
              <p>Total cliente: {formatCurrency(order.pricing.total)}</p>
              <p>Fee plataforma: {formatCurrency(order.pricing.serviceFee)}</p>
              <p>Delivery cliente: {formatCurrency(order.delivery_fee_customer)}</p>
              <p>Pago rider: {formatCurrency(order.rider_fee)}</p>
              <p>Estado envio: {statusLabels[order.delivery_status] ?? order.delivery_status}</p>
              <p>Rider: {order.assigned_rider_name ?? "Sin asignar"}</p>
            </div>

            {paymentBlocked && order.status === "created" ? (
              <p className="mt-4 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                Espera la aprobacion de Mercado Pago antes de aceptar este pedido.
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              {order.status === "created" || order.status === "accepted" ? (
                <Button
                  type="button"
                  className="bg-zinc-900 px-3 py-2 text-xs"
                  disabled={paymentBlocked || busyActionKey === `${order.id}:preparing`}
                  onClick={() => void onUpdateStatus(order.id, "preparing")}
                >
                  {busyActionKey === `${order.id}:preparing` ? "Guardando..." : "Aceptar pedido"}
                </Button>
              ) : null}

              {order.delivery_mode === "delivery" && order.status === "preparing" ? (
                <Button
                  type="button"
                  className="bg-zinc-900 px-3 py-2 text-xs"
                  disabled={busyActionKey === `${order.id}:ready_for_dispatch`}
                  onClick={() => void onUpdateStatus(order.id, "ready_for_dispatch")}
                >
                  {busyActionKey === `${order.id}:ready_for_dispatch` ? "Guardando..." : "Marcar listo"}
                </Button>
              ) : null}

              {order.delivery_mode === "pickup" && order.status === "preparing" ? (
                <Button
                  type="button"
                  className="bg-zinc-900 px-3 py-2 text-xs"
                  disabled={busyActionKey === `${order.id}:ready_for_pickup`}
                  onClick={() => void onUpdateStatus(order.id, "ready_for_pickup")}
                >
                  {busyActionKey === `${order.id}:ready_for_pickup` ? "Guardando..." : "Marcar listo"}
                </Button>
              ) : null}

              {order.delivery_mode === "pickup" && order.status === "ready_for_pickup" ? (
                <Button
                  type="button"
                  className="bg-zinc-900 px-3 py-2 text-xs"
                  disabled={busyActionKey === `${order.id}:delivered`}
                  onClick={() => void onUpdateStatus(order.id, "delivered")}
                >
                  {busyActionKey === `${order.id}:delivered` ? "Guardando..." : "Entregado"}
                </Button>
              ) : null}

              {canCancelOrder(order) ? (
                <Button
                  type="button"
                  className="bg-rose-600 px-3 py-2 text-xs shadow-none"
                  disabled={busyActionKey === `${order.id}:cancelled`}
                  onClick={() => void onUpdateStatus(order.id, "cancelled")}
                >
                  {busyActionKey === `${order.id}:cancelled` ? "Cancelando..." : "Cancelar"}
                </Button>
              ) : null}
            </div>

            {canAssignRider(order) ? (
              <div className="mt-4 rounded-[24px] border border-black/5 bg-zinc-50 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Asignacion</p>
                    <h4 className="mt-2 text-base font-bold text-ink">
                      {order.assigned_rider_id ? "Reasignar rider" : "Asignar rider"}
                    </h4>
                    <p className="mt-1 text-sm text-zinc-600">
                      Solo aparecen riders activos y disponibles del comercio.
                    </p>
                  </div>
                  <div className="flex w-full flex-col gap-2 md:w-auto md:min-w-[360px] md:flex-row">
                    <select
                      value={selectedRiderValue}
                      onChange={(event) =>
                        setSelectedRiders((current) => ({
                          ...current,
                          [order.id]: event.target.value
                        }))
                      }
                      disabled={!assignmentRiders.length || assignBusy}
                      className="min-w-[220px] rounded-full border border-black/10 bg-white px-4 py-3 text-sm text-zinc-700 outline-none"
                    >
                      {!assignmentRiders.length ? <option value="">Sin riders disponibles</option> : null}
                      {assignmentRiders.map((rider) => (
                        <option key={rider.user_id} value={rider.user_id}>
                          {rider.full_name} | {statusLabels[rider.availability] ?? rider.availability}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      disabled={!selectedRiderValue || assignBusy}
                      onClick={() => void onAssignRider(order.id, Number(selectedRiderValue))}
                    >
                      {assignBusy ? "Asignando..." : order.assigned_rider_id ? "Reasignar rider" : "Asignar rider"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
