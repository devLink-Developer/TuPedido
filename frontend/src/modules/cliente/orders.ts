import type { Order } from "../../shared/types";

const TERMINAL_ORDER_STATUSES = new Set(["delivered", "cancelled", "delivery_failed"]);
const TERMINAL_DELIVERY_STATUSES = new Set(["delivered", "delivery_failed"]);

function normalizeStatus(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function isTerminalCustomerOrder(order: Pick<Order, "status" | "delivery_status" | "delivered_at">) {
  const orderStatus = normalizeStatus(order.status);
  const deliveryStatus = normalizeStatus(order.delivery_status);

  return TERMINAL_ORDER_STATUSES.has(orderStatus) || TERMINAL_DELIVERY_STATUSES.has(deliveryStatus) || Boolean(order.delivered_at);
}

export function isActiveCustomerOrder(order: Pick<Order, "status" | "delivery_status" | "delivered_at">) {
  return !isTerminalCustomerOrder(order);
}

export function sortOrdersByNewest<T extends Pick<Order, "id" | "created_at">>(left: T, right: T) {
  const leftCreatedAt = Date.parse(left.created_at);
  const rightCreatedAt = Date.parse(right.created_at);

  if (!Number.isNaN(leftCreatedAt) && !Number.isNaN(rightCreatedAt) && leftCreatedAt !== rightCreatedAt) {
    return rightCreatedAt - leftCreatedAt;
  }

  return right.id - left.id;
}
