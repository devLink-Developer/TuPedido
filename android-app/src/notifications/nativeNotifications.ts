import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import type { AppNotification } from "../types/api";

const CHANNEL_ID = "kepedimos-orders";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

export async function ensureNativeNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Pedidos y novedades",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 120, 180],
      lightColor: "#EA580C"
    });
  }

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function showNativeNotification(notification: AppNotification): Promise<void> {
  const granted = await ensureNativeNotificationPermissions();
  if (!granted) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: notification.title || "Novedad de KePedimos",
      body: notification.body || "Tenés una actualización.",
      data: {
        notificationId: notification.id,
        orderId: notification.order_id,
        eventType: notification.event_type
      }
    },
    trigger: null
  });
}

export async function scheduleReviewReminderNotification(orderId: number, storeName: string, delaySeconds = 600): Promise<void> {
  const granted = await ensureNativeNotificationPermissions();
  if (!granted) return;
  const targetName = storeName.trim();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Calificá tu pedido",
      body: targetName ? `Ya podés contar cómo fue tu experiencia con ${targetName}.` : "Ya podés contar cómo fue tu experiencia.",
      data: {
        orderId,
        eventType: "order.review_prompt"
      }
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: delaySeconds
    }
  });
}
