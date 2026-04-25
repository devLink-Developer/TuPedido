import type {
  CheckoutRequest,
  CheckoutResponse,
  CreateOrderReviewPayload,
  Order,
  OrderTracking,
  PaymentTransaction,
  PendingOrderReview
} from "../../types";
import { buildPricingSummary } from "../../utils/pricing";
import { apiRequest, buildOrderSocketUrl } from "./client";

type RawOrder = Omit<Order, "pricing"> & {
  pricing?: Partial<Order["pricing"]> | null;
};

function mapOrder(raw: RawOrder): Order {
  return {
    ...raw,
    pricing: buildPricingSummary(raw)
  };
}

export async function checkout(token: string, payload: CheckoutRequest): Promise<CheckoutResponse> {
  return apiRequest<CheckoutResponse>("/checkout", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export async function fetchOrders(token: string): Promise<Order[]> {
  const orders = await apiRequest<RawOrder[]>("/orders", { token });
  return orders.map(mapOrder);
}

export async function fetchOrder(token: string, id: number): Promise<Order> {
  return mapOrder(await apiRequest<RawOrder>(`/orders/${id}`, { token }));
}

export async function fetchOrderTracking(token: string, id: number): Promise<OrderTracking> {
  return apiRequest<OrderTracking>(`/orders/${id}/tracking`, { token });
}

export async function fetchOrderPayment(token: string, id: number): Promise<PaymentTransaction> {
  return apiRequest<PaymentTransaction>(`/orders/${id}/payment`, { token });
}

export async function fetchPendingOrderReview(token: string): Promise<PendingOrderReview | null> {
  return apiRequest<PendingOrderReview | null>("/orders/pending-review", { token });
}

export async function createOrderReview(token: string, orderId: number, payload: CreateOrderReviewPayload): Promise<void> {
  await apiRequest<void>(`/orders/${orderId}/review`, {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export { buildOrderSocketUrl };
