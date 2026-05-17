import type { Address, AddressWrite, PostalCodeLookup } from "../../types/api";
import { apiRequest } from "./client";

export function fetchAddresses(token: string): Promise<Address[]> {
  return apiRequest<Address[]>("/addresses", { token });
}

export function createAddress(token: string, payload: AddressWrite): Promise<Address> {
  return apiRequest<Address>("/addresses", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export function updateAddress(token: string, addressId: number, payload: AddressWrite): Promise<Address> {
  return apiRequest<Address>(`/addresses/${addressId}`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload)
  });
}

export function deleteAddress(token: string, addressId: number): Promise<void> {
  return apiRequest<void>(`/addresses/${addressId}`, { method: "DELETE", token });
}

export function lookupPostalCode(token: string, postalCode: string): Promise<PostalCodeLookup> {
  return apiRequest<PostalCodeLookup>(`/addresses/postal-code/${encodeURIComponent(postalCode)}`, { token });
}

export function geocodeAddress(
  token: string,
  payload: { postal_code: string; province: string; locality: string; street_name: string; street_number: string }
): Promise<{ latitude: number; longitude: number; display_name: string | null }> {
  return apiRequest<{ latitude: number; longitude: number; display_name: string | null }>("/addresses/geocode", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export function reverseGeocodeAddress(
  token: string,
  payload: { latitude: number; longitude: number }
): Promise<{
  postal_code: string | null;
  province: string | null;
  locality: string | null;
  street_name: string | null;
  street_number: string | null;
  display_name: string | null;
}> {
  return apiRequest<{
    postal_code: string | null;
    province: string | null;
    locality: string | null;
    street_name: string | null;
    street_number: string | null;
    display_name: string | null;
  }>("/addresses/reverse-geocode", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}
