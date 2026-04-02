import type {
  AppNotification,
  DeliveryProfile,
  DeliverySettlement,
  DeliverySettlementPayment,
  DeliverySettlementPaymentAction,
  DeliverySettlementPaymentCreate,
  DeliveryZone,
  DeliveryZoneWrite,
  Order
} from "../../types";
import { buildPricingSummary } from "../../utils/pricing";
import { apiRequest, buildDeliverySocketUrl } from "./client";

type RawOrder = Omit<Order, "pricing"> & {
  pricing?: Partial<Order["pricing"]> | null;
};

function mapOrder(raw: RawOrder): Order {
  return {
    ...raw,
    pricing: buildPricingSummary(raw)
  };
}

export async function fetchDeliveryMe(token: string): Promise<DeliveryProfile> {
  return apiRequest<DeliveryProfile>("/delivery/me", { token });
}

export async function updateDeliveryAvailability(
  token: string,
  payload: { availability: "offline" | "idle" | "reserved" | "delivering" | "paused"; zone_id?: number | null }
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

export async function pushDeliveryLocation(
  token: string,
  payload: {
    order_id: number;
    latitude: number;
    longitude: number;
    heading?: number | null;
    speed_kmh?: number | null;
    accuracy_meters?: number | null;
  }
): Promise<Order> {
  return mapOrder(
    await apiRequest<RawOrder>("/delivery/me/location", {
      method: "POST",
      token,
      body: JSON.stringify(payload)
    })
  );
}

export async function fetchDeliveryNotifications(token: string): Promise<AppNotification[]> {
  return apiRequest<AppNotification[]>("/delivery/me/notifications", { token });
}

export async function fetchDeliverySettlements(token: string): Promise<DeliverySettlement> {
  return apiRequest<DeliverySettlement>("/delivery/me/settlements", { token });
}

export async function fetchDeliverySettlementPayments(token: string): Promise<DeliverySettlementPayment[]> {
  return apiRequest<DeliverySettlementPayment[]>("/delivery/me/settlement-payments", { token });
}

export async function confirmDeliverySettlementPayment(
  token: string,
  paymentId: number,
  payload: DeliverySettlementPaymentAction
): Promise<DeliverySettlementPayment> {
  return apiRequest<DeliverySettlementPayment>(`/delivery/me/settlement-payments/${paymentId}/confirm`, {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export async function disputeDeliverySettlementPayment(
  token: string,
  paymentId: number,
  payload: DeliverySettlementPaymentAction
): Promise<DeliverySettlementPayment> {
  return apiRequest<DeliverySettlementPayment>(`/delivery/me/settlement-payments/${paymentId}/dispute`, {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export async function createAdminDeliverySettlementPayment(
  token: string,
  payload: DeliverySettlementPaymentCreate
): Promise<{ id: number }> {
  return apiRequest<{ id: number }>("/admin/delivery/settlements/payments", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export async function createAdminDeliveryZone(token: string, payload: DeliveryZoneWrite): Promise<DeliveryZone> {
  return apiRequest<DeliveryZone>("/admin/delivery/zones", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export async function updateAdminDeliveryZone(token: string, zoneId: number, payload: DeliveryZoneWrite): Promise<DeliveryZone> {
  return apiRequest<DeliveryZone>(`/admin/delivery/zones/${zoneId}`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload)
  });
}

export { buildDeliverySocketUrl };
