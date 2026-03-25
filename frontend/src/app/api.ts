import type { AppNotification, Order, PaymentWebhookPayload, PushSubscriptionPayload } from "./types";
import { API_BASE_URL, apiRequest } from "../shared/services/api";

export * from "../shared/services/api";

type RequestOptions = RequestInit & {
  token?: string | null;
};

export function authHeaders(token: string | null | undefined): RequestOptions {
  return token ? { token } : {};
}

export async function fetchNotifications(token: string): Promise<AppNotification[]> {
  return apiRequest<AppNotification[]>("/notifications", { token });
}

export async function markNotificationRead(token: string, notificationId: number): Promise<AppNotification> {
  return apiRequest<AppNotification>(`/notifications/${notificationId}/read`, { method: "PUT", token });
}

export async function registerPushSubscription(token: string, payload: PushSubscriptionPayload): Promise<{ id: number }> {
  return apiRequest<{ id: number }>("/notifications/push-subscriptions", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export async function submitMercadoPagoWebhook(payload: PaymentWebhookPayload): Promise<Order> {
  return apiRequest<Order>("/payments/mercadopago/webhook", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export { API_BASE_URL };
