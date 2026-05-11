import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import { colors } from "../theme";
import { pushDeliveryLocation } from "../services/api";
import { readStoredSession } from "../state/sessionStorage";

export const DELIVERY_LOCATION_TASK = "kepedimos.delivery.location";
const ACTIVE_ORDER_ID_KEY = "kepedimos.delivery.active_order_id";

type LocationTaskData = {
  locations?: Location.LocationObject[];
};

let taskRegistered = false;

export function registerDeliveryLocationTask() {
  if (taskRegistered) return;
  taskRegistered = true;

  TaskManager.defineTask(DELIVERY_LOCATION_TASK, async ({ data, error }) => {
    if (error) return;
    const { locations } = (data ?? {}) as LocationTaskData;
    const latest = locations?.[locations.length - 1];
    if (!latest) return;

    const [session, orderIdRaw] = await Promise.all([readStoredSession(), AsyncStorage.getItem(ACTIVE_ORDER_ID_KEY)]);
    const orderId = Number(orderIdRaw);
    if (!session?.access_token || !Number.isFinite(orderId)) return;

    await pushDeliveryLocation(session.access_token, {
      order_id: orderId,
      latitude: latest.coords.latitude,
      longitude: latest.coords.longitude,
      heading: latest.coords.heading,
      speed_kmh: latest.coords.speed == null ? null : latest.coords.speed * 3.6,
      accuracy_meters: latest.coords.accuracy
    }).catch(() => undefined);
  });
}

export async function requestDeliveryLocationPermissions(): Promise<{ granted: boolean; message?: string }> {
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    return { granted: false, message: "Activá la ubicación del dispositivo para compartir el seguimiento." };
  }

  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== "granted") {
    return { granted: false, message: "La app necesita ubicación precisa para el reparto." };
  }

  if (Platform.OS === "android") {
    const background = await Location.requestBackgroundPermissionsAsync();
    if (background.status !== "granted") {
      return {
        granted: false,
        message: "Para seguir el pedido en segundo plano, habilitá el permiso de ubicación todo el tiempo en ajustes."
      };
    }
  }

  return { granted: true };
}

export async function startDeliveryLocationTracking(orderId: number): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_ORDER_ID_KEY, String(orderId));
  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(DELIVERY_LOCATION_TASK);
  if (alreadyStarted) return;

  await Location.startLocationUpdatesAsync(DELIVERY_LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: 15000,
    distanceInterval: 25,
    pausesUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: "KePedimos repartidor activo",
      notificationBody: "Compartiendo ubicación del pedido en curso.",
      notificationColor: colors.primary
    }
  });
}

export async function pushCurrentDeliveryLocation(authToken: string, orderId: number): Promise<void> {
  const current = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High
  });
  await pushDeliveryLocation(authToken, {
    order_id: orderId,
    latitude: current.coords.latitude,
    longitude: current.coords.longitude,
    heading: current.coords.heading,
    speed_kmh: current.coords.speed == null ? null : current.coords.speed * 3.6,
    accuracy_meters: current.coords.accuracy
  });
}

export async function stopDeliveryLocationTracking(): Promise<void> {
  await AsyncStorage.removeItem(ACTIVE_ORDER_ID_KEY);
  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(DELIVERY_LOCATION_TASK);
  if (alreadyStarted) {
    await Location.stopLocationUpdatesAsync(DELIVERY_LOCATION_TASK);
  }
}

export async function getTrackedOrderId(): Promise<number | null> {
  const value = await AsyncStorage.getItem(ACTIVE_ORDER_ID_KEY);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
