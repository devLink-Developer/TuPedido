import AsyncStorage from "@react-native-async-storage/async-storage";

export type StoredCustomerLocation = {
  latitude: number;
  longitude: number;
  source: "address" | "gps" | "route";
  addressId?: number;
};

type StoredCustomerLocationPayload = StoredCustomerLocation & {
  updatedAt: number;
};

const ANONYMOUS_LOCATION_KEY = "kepedimos.customer.anonymous.last_location";
const LAST_LOCATION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function customerLocationKey(userId: number) {
  return `kepedimos.customer.${userId}.last_location`;
}

function isValidStoredLocation(value: unknown): value is StoredCustomerLocationPayload {
  if (!value || typeof value !== "object") return false;
  const location = value as Partial<StoredCustomerLocationPayload>;
  const source = location.source;
  return (
    typeof location.latitude === "number" &&
    Number.isFinite(location.latitude) &&
    location.latitude >= -90 &&
    location.latitude <= 90 &&
    typeof location.longitude === "number" &&
    Number.isFinite(location.longitude) &&
    location.longitude >= -180 &&
    location.longitude <= 180 &&
    (source === "address" || source === "gps" || source === "route") &&
    typeof location.updatedAt === "number" &&
    Number.isFinite(location.updatedAt)
  );
}

function readKeys(userId: number | null | undefined) {
  return userId ? [customerLocationKey(userId), ANONYMOUS_LOCATION_KEY] : [ANONYMOUS_LOCATION_KEY];
}

function writeKey(userId: number | null | undefined) {
  return userId ? customerLocationKey(userId) : ANONYMOUS_LOCATION_KEY;
}

export async function readStoredCustomerLocation(userId: number | null | undefined): Promise<StoredCustomerLocation | null> {
  for (const key of readKeys(userId)) {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!isValidStoredLocation(parsed)) {
        await AsyncStorage.removeItem(key);
        continue;
      }
      if (Date.now() - parsed.updatedAt > LAST_LOCATION_MAX_AGE_MS) {
        await AsyncStorage.removeItem(key);
        continue;
      }
      return {
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        source: parsed.source,
        addressId: parsed.addressId
      };
    } catch {
      await AsyncStorage.removeItem(key);
    }
  }
  return null;
}

export async function writeStoredCustomerLocation(
  userId: number | null | undefined,
  location: StoredCustomerLocation | null
): Promise<void> {
  const key = writeKey(userId);
  if (!location) {
    await AsyncStorage.removeItem(key);
    return;
  }

  const payload: StoredCustomerLocationPayload = {
    latitude: location.latitude,
    longitude: location.longitude,
    source: location.source,
    addressId: location.addressId,
    updatedAt: Date.now()
  };
  await AsyncStorage.setItem(key, JSON.stringify(payload));
}
