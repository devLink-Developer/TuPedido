import type {
  DeliveryApplication,
  DeliveryApplicationCreate,
  MerchantApplication,
  MerchantApplicationCreate
} from "../../types";
import { apiRequest } from "./client";

export async function fetchMerchantApplications(token: string): Promise<MerchantApplication[]> {
  return apiRequest<MerchantApplication[]>("/merchant-applications", { token });
}

export async function createMerchantApplication(
  token: string,
  payload: MerchantApplicationCreate
): Promise<MerchantApplication> {
  return apiRequest<MerchantApplication>("/merchant-applications", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export async function fetchDeliveryApplications(token: string): Promise<DeliveryApplication[]> {
  return apiRequest<DeliveryApplication[]>("/delivery-applications", { token });
}

export async function createDeliveryApplication(
  token: string,
  payload: DeliveryApplicationCreate
): Promise<DeliveryApplication> {
  return apiRequest<DeliveryApplication>("/delivery-applications", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}
