import type { Address } from "../types/api";
import { hasAddressPin, locationFromAddress, pickPinnedCustomerAddress } from "./customerAddressSelection";

function address(overrides: Partial<Address>): Address {
  return {
    id: 1,
    label: "Casa",
    postal_code: "1000",
    province: "Buenos Aires",
    locality: "CABA",
    street: "Av Siempre Viva 123",
    details: null,
    latitude: -34.6,
    longitude: -58.38,
    is_default: false,
    ...overrides
  };
}

describe("customer address selection", () => {
  it("prefers the stored pinned address over the default", () => {
    const defaultAddress = address({ id: 1, is_default: true });
    const selectedAddress = address({ id: 2, label: "Trabajo", latitude: -34.7, longitude: -58.4 });

    expect(pickPinnedCustomerAddress([defaultAddress, selectedAddress], 2)).toBe(selectedAddress);
  });

  it("falls back to the default pinned address", () => {
    const firstAddress = address({ id: 1, is_default: false });
    const defaultAddress = address({ id: 2, is_default: true });

    expect(pickPinnedCustomerAddress([firstAddress, defaultAddress], 99)).toBe(defaultAddress);
  });

  it("ignores addresses without finite coordinates", () => {
    const withoutPin = address({ id: 1, latitude: null, longitude: null, is_default: true });
    const withPin = address({ id: 2, is_default: false });

    expect(hasAddressPin(withoutPin)).toBe(false);
    expect(pickPinnedCustomerAddress([withoutPin, withPin], 1)).toBe(withPin);
  });

  it("builds an address location with the selected address id", () => {
    const selectedAddress = address({ id: 7, latitude: -34.61, longitude: -58.37 });

    if (!hasAddressPin(selectedAddress)) throw new Error("Expected address to have coordinates");

    expect(locationFromAddress(selectedAddress)).toEqual({
      latitude: -34.61,
      longitude: -58.37,
      source: "address",
      addressId: 7
    });
  });
});
