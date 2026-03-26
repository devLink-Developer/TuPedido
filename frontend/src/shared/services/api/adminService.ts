import type {
  AdminMerchantCreate,
  AdminRiderCreate,
  AdminSettlementStore,
  AuthUser,
  Category,
  CategoryWrite,
  DeliveryApplication,
  DeliveryProfile,
  DeliverySettlement,
  DeliveryZone,
  MerchantApplication,
  Order,
  PlatformSettings,
  PlatformSettingsUpdate,
  SettlementNotice,
  SettlementPayment,
  SettlementPaymentCreate,
  StoreDetail,
  StoreStatusUpdate,
  StoreSummary
} from "../../types";
import { buildPricingSummary } from "../../utils/pricing";
import { apiRequest } from "./client";

type RawOrder = Omit<Order, "pricing"> & {
  pricing?: Partial<Order["pricing"]> | null;
};

function mapOrder(raw: RawOrder): Order {
  return {
    ...raw,
    pricing: buildPricingSummary(raw)
  };
}

export async function fetchAdminCategories(token: string): Promise<Category[]> {
  return apiRequest<Category[]>("/admin/categories", { token });
}

export async function createAdminCategory(token: string, payload: CategoryWrite): Promise<Category> {
  return apiRequest<Category>("/admin/categories", { method: "POST", token, body: JSON.stringify(payload) });
}

export async function updateAdminCategory(token: string, categoryId: number, payload: CategoryWrite): Promise<Category> {
  return apiRequest<Category>(`/admin/categories/${categoryId}`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload)
  });
}

export async function deleteAdminCategory(token: string, categoryId: number): Promise<Category> {
  return apiRequest<Category>(`/admin/categories/${categoryId}`, {
    method: "DELETE",
    token
  });
}

export async function fetchAdminApplications(token: string): Promise<MerchantApplication[]> {
  return apiRequest<MerchantApplication[]>("/admin/stores/applications", { token });
}

export async function reviewMerchantApplication(
  token: string,
  applicationId: number,
  payload: { status: "approved" | "rejected" | "suspended"; review_notes?: string | null }
): Promise<MerchantApplication> {
  return apiRequest<MerchantApplication>(`/admin/stores/applications/${applicationId}`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload)
  });
}

export async function fetchAdminStores(token: string): Promise<StoreSummary[]> {
  return apiRequest<StoreSummary[]>("/admin/stores", { token });
}

export async function createAdminStore(token: string, payload: AdminMerchantCreate): Promise<StoreDetail> {
  return apiRequest<StoreDetail>("/admin/stores", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export async function updateAdminStoreStatus(
  token: string,
  storeId: number,
  payload: StoreStatusUpdate
): Promise<StoreDetail> {
  return apiRequest<StoreDetail>(`/admin/stores/${storeId}/status`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload)
  });
}

export async function fetchAdminOrders(token: string): Promise<Order[]> {
  const orders = await apiRequest<RawOrder[]>("/admin/orders", { token });
  return orders.map(mapOrder);
}

export async function fetchAdminUsers(token: string): Promise<AuthUser[]> {
  return apiRequest<AuthUser[]>("/admin/users", { token });
}

export async function fetchPlatformSettings(token: string): Promise<PlatformSettings> {
  return apiRequest<PlatformSettings>("/admin/platform-settings", { token });
}

export async function updatePlatformSettings(token: string, payload: PlatformSettingsUpdate): Promise<PlatformSettings> {
  return apiRequest<PlatformSettings>("/admin/platform-settings", {
    method: "PUT",
    token,
    body: JSON.stringify(payload)
  });
}

export async function fetchAdminSettlementStores(token: string): Promise<AdminSettlementStore[]> {
  return apiRequest<AdminSettlementStore[]>("/admin/settlements/stores", { token });
}

export async function fetchAdminSettlementNotices(token: string): Promise<SettlementNotice[]> {
  return apiRequest<SettlementNotice[]>("/admin/settlements/notices", { token });
}

export async function reviewAdminSettlementNotice(
  token: string,
  id: number,
  payload: { status: "approved" | "rejected" | "pending"; review_notes?: string | null }
): Promise<SettlementNotice> {
  return apiRequest<SettlementNotice>(`/admin/settlements/notices/${id}`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload)
  });
}

export async function fetchAdminSettlementPayments(token: string): Promise<SettlementPayment[]> {
  return apiRequest<SettlementPayment[]>("/admin/settlements/payments", { token });
}

export async function createAdminSettlementPayment(
  token: string,
  payload: SettlementPaymentCreate
): Promise<SettlementPayment> {
  return apiRequest<SettlementPayment>("/admin/settlements/payments", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export async function fetchAdminDeliveryApplications(token: string): Promise<DeliveryApplication[]> {
  return apiRequest<DeliveryApplication[]>("/admin/delivery-applications", { token });
}

export async function reviewAdminDeliveryApplication(
  token: string,
  applicationId: number,
  payload: { status: "pending_review" | "approved" | "rejected" | "suspended"; review_notes?: string | null }
): Promise<DeliveryApplication> {
  return apiRequest<DeliveryApplication>(`/admin/delivery-applications/${applicationId}`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload)
  });
}

export async function fetchAdminDeliveryRiders(token: string): Promise<DeliveryProfile[]> {
  return apiRequest<DeliveryProfile[]>("/admin/delivery/riders", { token });
}

export async function createAdminRider(token: string, payload: AdminRiderCreate): Promise<DeliveryProfile> {
  return apiRequest<DeliveryProfile>("/admin/delivery/riders", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export async function fetchAdminDeliveryZones(token: string): Promise<DeliveryZone[]> {
  return apiRequest<DeliveryZone[]>("/admin/delivery/zones", { token });
}

export async function fetchAdminDeliveryDispatch(token: string): Promise<Order[]> {
  const orders = await apiRequest<RawOrder[]>("/admin/delivery/dispatch", { token });
  return orders.map(mapOrder);
}

export async function assignAdminDeliveryOrder(token: string, orderId: number, rider_user_id: number): Promise<Order> {
  return mapOrder(
    await apiRequest<RawOrder>(`/admin/delivery/dispatch/${orderId}/assign`, {
      method: "PUT",
      token,
      body: JSON.stringify({ rider_user_id })
    })
  );
}

export async function fetchAdminDeliverySettlements(token: string): Promise<DeliverySettlement[]> {
  return apiRequest<DeliverySettlement[]>("/admin/delivery/settlements", { token });
}
