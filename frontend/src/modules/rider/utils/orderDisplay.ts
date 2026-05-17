import type { Order } from "../../../shared/types";

export function getRiderCustomerName(order: Pick<Order, "customer_name">) {
  return order.customer_name?.trim() || "Sin nombre";
}

export function getRiderDeliveryAddress(order: Pick<Order, "delivery_mode" | "address_full">) {
  if (order.delivery_mode === "pickup") {
    return "Retiro en local";
  }
  return order.address_full?.trim() || "Direccion pendiente";
}
