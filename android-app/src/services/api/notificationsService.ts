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

export { buildNotificationsSocketUrl };
