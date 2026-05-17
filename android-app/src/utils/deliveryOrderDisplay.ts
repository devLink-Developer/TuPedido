import type { Order } from "../types/api";

function compactDeliveryAddress(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");
  const parts = normalized
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 2) {
    return normalized;
  }

  return parts.slice(0, 2).join(", ");
}

export function getRiderCustomerName(order: Pick<Order, "customer_name">) {
  return order.customer_name?.trim() || "Sin nombre";
}

export function getRiderDeliveryAddress(order: Pick<Order, "delivery_mode" | "address_full">) {
  if (order.delivery_mode === "pickup") {
    return "Retiro en local";
  }
  return order.address_full ? compactDeliveryAddress(order.address_full) : "Direccion pendiente";
}
