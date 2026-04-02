import { useEffect, useState } from "react";
import { buildNotificationsSocketUrl, fetchNotifications, REALTIME_ENABLED } from "../services/api";
import type { AppNotification } from "../types";

function mergeNotifications(current: AppNotification[], incoming: AppNotification[]) {
  const byId = new Map<number, AppNotification>();
  for (const item of [...incoming, ...current]) {
    byId.set(item.id, item);
  }
  return [...byId.values()].sort((left, right) => (left.created_at < right.created_at ? 1 : -1));
}

export function useRealtimeNotifications(token: string | null, enabled = true) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (!token || !enabled) {
      setNotifications([]);
      return;
    }
    fetchNotifications(token)
      .then((items) => setNotifications(items))
      .catch(() => {});
  }, [enabled, token]);

  useEffect(() => {
    if (!token || !enabled || !REALTIME_ENABLED) {
      return;
    }

    let socket: WebSocket | null = null;
    try {
      socket = new WebSocket(buildNotificationsSocketUrl(token));
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (Array.isArray(payload?.notifications)) {
            setNotifications((current) => mergeNotifications(current, payload.notifications as AppNotification[]));
          }
        } catch {
          // Keep HTTP state as fallback.
        }
      };
    } catch {
      return;
    }

    return () => {
      socket?.close();
    };
  }, [enabled, token]);

  return { notifications, setNotifications };
}
