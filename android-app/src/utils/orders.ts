import type { Order } from "../types/api";

const TERMINAL_ORDER_STATUSES = new Set(["delivered", "cancelled", "delivery_failed"]);
const TERMINAL_DELIVERY_STATUSES = new Set(["delivered", "delivery_failed"]);

export const CUSTOMER_ORDER_STATUS_NOTIFICATION_EVENTS = new Set([
  "order.preparing",
  "order.ready_for_dispatch",
  "order.ready_for_pickup",
  "delivery.assigned",
  "delivery.picked_up",
  "order.delivered",
  "order.cancelled"
]);

type OrderState = Pick<Order, "id" | "created_at" | "status" | "delivery_status" | "delivered_at">;

function normalizeStatus(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function isTerminalCustomerOrder(order: Pick<Order, "status" | "delivery_status" | "delivered_at">): boolean {
  const orderStatus = normalizeStatus(order.status);
  const deliveryStatus = normalizeStatus(order.delivery_status);

  return TERMINAL_ORDER_STATUSES.has(orderStatus) || TERMINAL_DELIVERY_STATUSES.has(deliveryStatus) || Boolean(order.delivered_at);
}

export function isActiveCustomerOrder(order: Pick<Order, "status" | "delivery_status" | "delivered_at">): boolean {
  return !isTerminalCustomerOrder(order);
}

export function sortOrdersByNewest<T extends Pick<Order, "id" | "created_at">>(left: T, right: T): number {
  const leftCreatedAt = Date.parse(left.created_at);
  const rightCreatedAt = Date.parse(right.created_at);

  if (!Number.isNaN(leftCreatedAt) && !Number.isNaN(rightCreatedAt) && leftCreatedAt !== rightCreatedAt) {
    return rightCreatedAt - leftCreatedAt;
  }

  return right.id - left.id;
}

export function pickActiveCustomerOrder<T extends OrderState>(orders: T[]): T | null {
  return [...orders].filter(isActiveCustomerOrder).sort(sortOrdersByNewest)[0] ?? null;
}
