import type { AppNotification } from "../../types/api";
import { apiRequest, buildNotificationsSocketUrl } from "./client";

export function fetchNotifications(token: string): Promise<AppNotification[]> {
  return apiRequest<AppNotification[]>("/notifications", { token });
}

export function markNotificationRead(token: string, notificationId: number): Promise<AppNotification> {
  return apiRequest<AppNotification>(`/notifications/${notificationId}/read`, {
    method: "PUT",
    token
  });
}

export function markAllNotificationsRead(token: string): Promise<AppNotification[]> {
  return apiRequest<AppNotification[]>("/notifications/read-all", {
    method: "PUT",
    token
  });
}

export function registerPushSubscription(
  token: string,
  payload: {
    push_token: string;
    endpoint?: string;
    keys?: Record<string, string>;
    push_provider?: string;
    platform?: string;
    user_agent?: string;
  }
): Promise<{ id: number; endpoint: string; created_at: string | null }> {
  return apiRequest<{ id: number; endpoint: string; created_at: string | null }>("/notifications/push-subscriptions", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export { buildNotificationsSocketUrl };
