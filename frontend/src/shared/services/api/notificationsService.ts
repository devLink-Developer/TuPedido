import type { AppNotification } from "../../types";
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
