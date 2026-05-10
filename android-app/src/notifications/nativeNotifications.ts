import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import type { AppNotification } from "../types/api";
import { EXPO_PROJECT_ID } from "../config/env";
import { registerPushSubscription } from "../services/api/notificationsService";

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

export async function registerRemotePushNotifications(authToken: string): Promise<string | null> {
  const granted = await ensureNativeNotificationPermissions();
  if (!granted || !EXPO_PROJECT_ID) return null;

  const expoToken = await Notifications.getExpoPushTokenAsync({ projectId: EXPO_PROJECT_ID });
  await registerPushSubscription(authToken, {
    push_token: expoToken.data,
    endpoint: expoToken.data,
    keys: {
      p256dh: "expo",
      auth: "expo"
    },
    push_provider: "expo",
    platform: Platform.OS,
    user_agent: `kepedimos-${Platform.OS}`
  });
  return expoToken.data;
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
