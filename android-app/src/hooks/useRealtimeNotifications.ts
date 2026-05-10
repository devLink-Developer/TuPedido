import { useEffect, useState } from "react";
import { buildDeliverySocketUrl, buildNotificationsSocketUrl, fetchDeliveryNotifications, fetchNotifications } from "../services/api";
import type { AppNotification, Role } from "../types/api";

function mergeNotifications(current: AppNotification[], incoming: AppNotification[]) {
  const byId = new Map<number, AppNotification>();
  for (const item of [...incoming, ...current]) byId.set(item.id, item);
  return [...byId.values()].sort((left, right) => (left.created_at < right.created_at ? 1 : -1));
}

export function useRealtimeNotifications(token: string | null, role: Role | null | undefined, enabled = true) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !enabled || !role) {
      setNotifications([]);
      return;
    }

    const authToken = token;
    let cancelled = false;
    async function load() {
      try {
        const items = role === "delivery" ? await fetchDeliveryNotifications(authToken) : await fetchNotifications(authToken);
        if (!cancelled) setNotifications(items);
      } catch {
        if (!cancelled) setError("No se pudieron cargar notificaciones");
      }
    }
    void load();
    const timer = setInterval(() => void load(), 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled, role, token]);

  useEffect(() => {
    if (!token || !enabled || !role) return;
    const url = role === "delivery" ? buildDeliverySocketUrl(token) : buildNotificationsSocketUrl(token);
    let socket: WebSocket | null = null;
    try {
      socket = new WebSocket(url);
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (Array.isArray(payload?.notifications)) {
            setNotifications((current) => mergeNotifications(current, payload.notifications as AppNotification[]));
          }
          if (payload?.notification) {
            setNotifications((current) => mergeNotifications(current, [payload.notification as AppNotification]));
          }
          setError(null);
        } catch {
          setError("No se pudo actualizar la notificación.");
        }
      };
      socket.onerror = () => setError(null);
    } catch {
      setError(null);
    }
    return () => socket?.close();
  }, [enabled, role, token]);

  return { notifications, setNotifications, error };
}
