import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { pushDeliveryLocation } from "../services/api";
import { readStoredSession } from "../state/sessionStorage";

export const DELIVERY_LOCATION_TASK = "kepedimos.delivery.location";
const ACTIVE_ORDER_ID_KEY = "kepedimos.delivery.active_order_id";

let activeLocationSubscription: Location.LocationSubscription | null = null;
let activeLocationOrderId: number | null = null;

export async function requestDeliveryLocationPermissions(): Promise<{ granted: boolean; message?: string }> {
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    return { granted: false, message: "Activa la ubicacion del dispositivo para compartir el seguimiento." };
  }

  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== "granted") {
    return { granted: false, message: "La app necesita ubicacion mientras esta en uso para el reparto." };
  }

  return { granted: true };
}

async function pushLocationUpdate(latest: Location.LocationObject): Promise<void> {
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
}

export async function startDeliveryLocationTracking(orderId: number): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_ORDER_ID_KEY, String(orderId));
  if (activeLocationSubscription && activeLocationOrderId === orderId) return;

  activeLocationSubscription?.remove();
  activeLocationSubscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 15000,
      distanceInterval: 25
    },
    (location) => {
      void pushLocationUpdate(location);
    }
  );
  activeLocationOrderId = orderId;
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
  try {
    activeLocationSubscription?.remove();
    activeLocationSubscription = null;
    activeLocationOrderId = null;
  } finally {
    await AsyncStorage.removeItem(ACTIVE_ORDER_ID_KEY);
  }
}

export async function getTrackedOrderId(): Promise<number | null> {
  return activeLocationOrderId;
}
