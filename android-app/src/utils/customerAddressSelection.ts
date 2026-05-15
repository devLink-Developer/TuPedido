import type { Address } from "../types/api";

export type PinnedAddress = Address & { latitude: number; longitude: number };
export type CustomerAddressLocation = {
  latitude: number;
  longitude: number;
  source: "address";
  addressId: number;
};

export function hasAddressPin(address: Address | null | undefined): address is PinnedAddress {
  return (
    typeof address?.latitude === "number" &&
    typeof address.longitude === "number" &&
    Number.isFinite(address.latitude) &&
    Number.isFinite(address.longitude)
  );
}

export function pickPinnedCustomerAddress(
  addresses: Address[],
  preferredAddressId: number | null | undefined
): PinnedAddress | null {
  const pinnedAddresses = addresses.filter(hasAddressPin);
  return (
    pinnedAddresses.find((address) => address.id === preferredAddressId) ??
    pinnedAddresses.find((address) => address.is_default) ??
    pinnedAddresses[0] ??
    null
  );
}

export function locationFromAddress(address: PinnedAddress): CustomerAddressLocation {
  return {
    latitude: address.latitude,
    longitude: address.longitude,
    source: "address",
    addressId: address.id
  };
}
