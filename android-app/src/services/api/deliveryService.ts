import type {
  AppNotification,
  DeliveryAvailability,
  DeliveryLocationPayload,
  DeliveryProfile,
  DeliverySettlement,
  DeliverySettlementPayment,
  Order
} from "../../types/api";
import { withPricing } from "../../utils/pricing";
import { apiRequest, buildDeliverySocketUrl } from "./client";

type RawOrder = Omit<Order, "pricing"> & {
  pricing?: Partial<Order["pricing"]> | null;
};

function mapOrder(order: RawOrder): Order {
  return withPricing(order) as Order;
}

export function fetchDeliveryMe(token: string): Promise<DeliveryProfile> {
  return apiRequest<DeliveryProfile>("/delivery/me", { token });
}

export function updateDeliveryAvailability(
  token: string,
  payload: { availability: DeliveryAvailability; zone_id?: number | null }
): Promise<DeliveryProfile> {
  return apiRequest<DeliveryProfile>("/delivery/me/availability", {
    method: "PUT",
    token,
    body: JSON.stringify(payload)
  });
}

export async function fetchDeliveryOrders(token: string): Promise<Order[]> {
  const orders = await apiRequest<RawOrder[]>("/delivery/me/orders", { token });
  return orders.map(mapOrder);
}

export async function acceptDeliveryOrder(token: string, orderId: number): Promise<Order> {
  return mapOrder(await apiRequest<RawOrder>(`/delivery/me/orders/${orderId}/accept`, { method: "POST", token }));
}

export async function pickupDeliveryOrder(token: string, orderId: number): Promise<Order> {
  return mapOrder(await apiRequest<RawOrder>(`/delivery/me/orders/${orderId}/pickup`, { method: "POST", token }));
}

export async function deliverDeliveryOrder(token: string, orderId: number, otp_code?: string | null): Promise<Order> {
  return mapOrder(
    await apiRequest<RawOrder>(`/delivery/me/orders/${orderId}/deliver`, {
      method: "POST",
      token,
      body: JSON.stringify({ otp_code: otp_code ?? null })
    })
  );
}

export async function pushDeliveryLocation(token: string, payload: DeliveryLocationPayload): Promise<Order> {
  return mapOrder(
    await apiRequest<RawOrder>("/delivery/me/location", {
      method: "POST",
      token,
      body: JSON.stringify(payload)
    })
  );
}

export function fetchDeliveryNotifications(token: string): Promise<AppNotification[]> {
  return apiRequest<AppNotification[]>("/delivery/me/notifications", { token });
}

export function fetchDeliverySettlements(token: string): Promise<DeliverySettlement> {
  return apiRequest<DeliverySettlement>("/delivery/me/settlements", { token });
}

export function fetchDeliverySettlementPayments(token: string): Promise<DeliverySettlementPayment[]> {
  return apiRequest<DeliverySettlementPayment[]>("/delivery/me/settlement-payments", { token });
}

export function confirmDeliverySettlementPayment(token: string, paymentId: number, notes: string): Promise<DeliverySettlementPayment> {
  return apiRequest<DeliverySettlementPayment>(`/delivery/me/settlement-payments/${paymentId}/confirm`, {
    method: "POST",
    token,
    body: JSON.stringify({ notes })
  });
}

export function disputeDeliverySettlementPayment(token: string, paymentId: number, notes: string): Promise<DeliverySettlementPayment> {
  return apiRequest<DeliverySettlementPayment>(`/delivery/me/settlement-payments/${paymentId}/dispute`, {
    method: "POST",
    token,
    body: JSON.stringify({ notes })
  });
}

export { buildDeliverySocketUrl };
