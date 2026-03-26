import type { Address, AddressGeocodeRequest, AddressGeocodeResult, AddressPostalCodeLookup, AddressWrite } from "../../types";
import { apiRequest } from "./client";

export async function fetchAddresses(token: string): Promise<Address[]> {
  return apiRequest<Address[]>("/addresses", { token });
}

export async function createAddress(
  token: string,
  payload: AddressWrite
): Promise<Address> {
  return apiRequest<Address>("/addresses", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export async function updateAddress(
  token: string,
  id: number,
  payload: AddressWrite
): Promise<Address> {
  return apiRequest<Address>(`/addresses/${id}`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload)
  });
}

export async function deleteAddress(token: string, id: number): Promise<void> {
  await apiRequest<void>(`/addresses/${id}`, { method: "DELETE", token });
}

export async function lookupPostalCode(token: string, postalCode: string): Promise<AddressPostalCodeLookup> {
  return apiRequest<AddressPostalCodeLookup>(`/addresses/postal-code/${encodeURIComponent(postalCode)}`, { token });
}

export async function geocodeAddress(token: string, payload: AddressGeocodeRequest): Promise<AddressGeocodeResult> {
  return apiRequest<AddressGeocodeResult>("/addresses/geocode", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}
