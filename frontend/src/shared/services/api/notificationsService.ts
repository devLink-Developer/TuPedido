import type { AppNotification, PushSubscriptionPayload, PushSubscriptionResponse, WebPushPublicKeyResponse } from "../../types";
import { apiRequest } from "./client";

export async function fetchNotifications(token: string): Promise<AppNotification[]> {
  return apiRequest<AppNotification[]>("/notifications", { token });
}

export async function markNotificationRead(token: string, notificationId: number): Promise<AppNotification> {
  return apiRequest<AppNotification>(`/notifications/${notificationId}/read`, {
    method: "PUT",
    token
  });
}

export async function fetchWebPushPublicKey(): Promise<string> {
  const payload = await apiRequest<WebPushPublicKeyResponse>("/notifications/web-push/public-key");
  const key = payload.public_key ?? payload.publicKey ?? payload.vapid_public_key;
  if (!key) {
    throw new Error("Missing web push public key");
  }
  return key;
}

export async function registerPushSubscription(
  token: string,
  payload: PushSubscriptionPayload
): Promise<PushSubscriptionResponse> {
  return apiRequest<PushSubscriptionResponse>("/notifications/push-subscriptions", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export async function unregisterPushSubscription(token: string, endpoint: string): Promise<void> {
  await apiRequest<void>("/notifications/push-subscriptions", {
    method: "DELETE",
    token,
    body: JSON.stringify({ endpoint })
  });
}
