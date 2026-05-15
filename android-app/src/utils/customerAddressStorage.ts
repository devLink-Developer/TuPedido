import AsyncStorage from "@react-native-async-storage/async-storage";

function selectedDeliveryAddressKey(userId: number) {
  return `kepedimos.customer.${userId}.selected_delivery_address_id`;
}

export async function readStoredSelectedDeliveryAddressId(userId: number | null | undefined): Promise<number | null> {
  if (!userId) return null;
  const raw = await AsyncStorage.getItem(selectedDeliveryAddressKey(userId));
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function writeStoredSelectedDeliveryAddressId(
  userId: number | null | undefined,
  addressId: number | null
): Promise<void> {
  if (!userId) return;
  const key = selectedDeliveryAddressKey(userId);
  if (addressId == null) {
    await AsyncStorage.removeItem(key);
    return;
  }
  await AsyncStorage.setItem(key, String(addressId));
}
