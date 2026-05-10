import type {
  CheckoutRequest,
  CheckoutResponse,
  CreateOrderReviewPayload,
  Order,
  OrderTracking,
  PaymentTransaction,
  PendingOrderReview
} from "../../types/api";
import { withPricing } from "../../utils/pricing";
import { apiRequest, buildOrderSocketUrl } from "./client";

type RawOrder = Omit<Order, "pricing"> & {
  pricing?: Partial<Order["pricing"]> | null;
};

function mapOrder(order: RawOrder): Order {
  return withPricing(order) as Order;
}

export function checkout(token: string, payload: CheckoutRequest): Promise<CheckoutResponse> {
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

export async function fetchOrder(token: string, orderId: number): Promise<Order> {
  return mapOrder(await apiRequest<RawOrder>(`/orders/${orderId}`, { token }));
}

export function fetchOrderTracking(token: string, orderId: number): Promise<OrderTracking> {
  return apiRequest<OrderTracking>(`/orders/${orderId}/tracking`, { token });
}

export function fetchOrderPayment(token: string, orderId: number): Promise<PaymentTransaction> {
  return apiRequest<PaymentTransaction>(`/orders/${orderId}/payment`, { token });
}

export function fetchPendingOrderReview(token: string): Promise<PendingOrderReview | null> {
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
