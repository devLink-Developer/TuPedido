import { createContext, useContext, useEffect, useMemo, useRef, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { AppState } from "react-native";
import {
  registerRemotePushNotifications,
  scheduleReviewReminderNotification,
  showNativeNotification
} from "../notifications/nativeNotifications";
import { useRealtimeNotifications } from "../hooks/useRealtimeNotifications";
import { useAppFeedback } from "./AppFeedbackContext";
import { useAuth } from "./AuthContext";
import type { AppNotification } from "../types/api";

type NotificationsContextValue = {
  notifications: AppNotification[];
  setNotifications: Dispatch<SetStateAction<AppNotification[]>>;
  unreadCount: number;
  error: string | null;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth();
  const { showDialog } = useAppFeedback();
  const { notifications, setNotifications, error } = useRealtimeNotifications(token, user?.role);
  const seenIdsRef = useRef<Set<number> | null>(null);
  const unreadCount = useMemo(() => notifications.filter((item) => !item.is_read).length, [notifications]);

  useEffect(() => {
    if (!token || !user) return;
    void registerRemotePushNotifications(token).catch(() => undefined);
  }, [token, user]);

  useEffect(() => {
    const nextIds = new Set(notifications.map((item) => item.id));
    if (!seenIdsRef.current) {
      seenIdsRef.current = nextIds;
      return;
    }

    const previousIds = seenIdsRef.current;
    const freshUnread = notifications.find((item) => !item.is_read && !previousIds.has(item.id));
    seenIdsRef.current = nextIds;
    if (freshUnread) {
      if (freshUnread.event_type === "order.delivered" && freshUnread.order_id) {
        void scheduleReviewReminderNotification(freshUnread.order_id, "tu pedido").catch(() => undefined);
      }
      if (AppState.currentState === "active") {
        showDialog({
          title: freshUnread.title || "Novedad del pedido",
          message: freshUnread.body || "Tu pedido tuvo una actualización.",
          variant: "info"
        });
      } else {
        void showNativeNotification(freshUnread).catch(() => undefined);
      }
    }
  }, [notifications, showDialog]);

  const value = useMemo(
    () => ({ notifications, setNotifications, unreadCount, error }),
    [error, notifications, setNotifications, unreadCount]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotificationsState() {
  const value = useContext(NotificationsContext);
  if (!value) {
    throw new Error("useNotificationsState must be used inside NotificationsProvider");
  }
  return value;
}
