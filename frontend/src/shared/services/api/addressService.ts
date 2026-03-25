import type { Address } from "../../types";
import { apiRequest } from "./client";

export async function fetchAddresses(token: string): Promise<Address[]> {
  return apiRequest<Address[]>("/addresses", { token });
}

export async function createAddress(
  token: string,
  payload: Omit<Address, "id">
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
  payload: Omit<Address, "id">
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
