import type { Order } from "../../shared/types";

const TERMINAL_ORDER_STATUSES = new Set(["delivered", "cancelled", "delivery_failed"]);

export function isActiveCustomerOrder(order: Order) {
  return !TERMINAL_ORDER_STATUSES.has(order.status);
}

export function sortOrdersByNewest(left: Order, right: Order) {
  const leftCreatedAt = Date.parse(left.created_at);
  const rightCreatedAt = Date.parse(right.created_at);

  if (!Number.isNaN(leftCreatedAt) && !Number.isNaN(rightCreatedAt) && leftCreatedAt !== rightCreatedAt) {
    return rightCreatedAt - leftCreatedAt;
  }

  return right.id - left.id;
}
