import type {
  DeliveryProfile,
  DeliverySettlement,
  MerchantRiderCreate,
  MerchantRiderSettlementPaymentCreate,
  MerchantRiderUpdate,
  MercadoPagoConnectResponse,
  MercadoPagoDisconnectResponse,
  MerchantStore,
  Order,
  OrderStatusUpdate,
  Product,
  ProductCategory,
  ProductCategoryCreate,
  ProductCategoryUpdate,
  ProductSubcategory,
  ProductSubcategoryCreate,
  ProductSubcategoryUpdate,
  ProductWrite,
  SettlementCharge,
  SettlementNoticeCreate,
  SettlementNotice,
  SettlementOverview,
  StoreCategoriesUpdate,
  StoreDeliverySettingsUpdate,
  StoreHourWrite,
  StorePaymentSettingsUpdate,
  StoreUpdate
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

export async function fetchMerchantStore(token: string): Promise<MerchantStore> {
  return apiRequest<MerchantStore>("/merchant/store", { token });
}

export async function updateMerchantStore(token: string, payload: StoreUpdate): Promise<MerchantStore> {
  return apiRequest<MerchantStore>("/merchant/store", {
    method: "PUT",
    token,
    body: JSON.stringify(payload)
  });
}

export async function updateMerchantStoreCategories(
  token: string,
  payload: StoreCategoriesUpdate
): Promise<MerchantStore> {
  return apiRequest<MerchantStore>("/merchant/store/categories", {
    method: "PUT",
    token,
    body: JSON.stringify(payload)
  });
}

export async function updateMerchantStoreHours(
  token: string,
  payload: { hours: StoreHourWrite[] }
): Promise<MerchantStore> {
  return apiRequest<MerchantStore>("/merchant/store/hours", {
    method: "PUT",
    token,
    body: JSON.stringify(payload)
  });
}

export async function updateMerchantDeliverySettings(
  token: string,
  payload: StoreDeliverySettingsUpdate
): Promise<MerchantStore> {
  return apiRequest<MerchantStore>("/merchant/store/delivery-settings", {
    method: "PUT",
    token,
    body: JSON.stringify(payload)
  });
}

export async function updateMerchantPaymentSettings(
  token: string,
  payload: StorePaymentSettingsUpdate
): Promise<MerchantStore> {
  return apiRequest<MerchantStore>("/merchant/store/payment-settings", {
    method: "PUT",
    token,
    body: JSON.stringify(payload)
  });
}

export async function fetchMerchantMercadoPagoConnectUrl(token: string): Promise<MercadoPagoConnectResponse> {
  return apiRequest<MercadoPagoConnectResponse>("/oauth/mercadopago/session", {
    method: "POST",
    token,
    credentials: "include"
  });
}

export async function disconnectMerchantMercadoPago(token: string): Promise<MercadoPagoDisconnectResponse> {
  return apiRequest<MercadoPagoDisconnectResponse>("/oauth/mercadopago/disconnect", {
    method: "POST",
    token
  });
}

export async function fetchMerchantSettlementOverview(token: string): Promise<SettlementOverview> {
  return apiRequest<SettlementOverview>("/merchant/settlements/overview", { token });
}

export async function fetchMerchantSettlementCharges(token: string): Promise<SettlementCharge[]> {
  return apiRequest<SettlementCharge[]>("/merchant/settlements/charges", { token });
}

export async function fetchMerchantSettlementNotices(token: string): Promise<SettlementNotice[]> {
  return apiRequest<SettlementNotice[]>("/merchant/settlements/notices", { token });
}

export async function createMerchantSettlementNotice(
  token: string,
  payload: SettlementNoticeCreate
): Promise<SettlementNotice> {
  return apiRequest<SettlementNotice>("/merchant/settlements/notices", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export async function fetchMerchantProductCategories(token: string): Promise<ProductCategory[]> {
  return apiRequest<ProductCategory[]>("/merchant/product-categories", { token });
}

export async function createMerchantProductCategory(
  token: string,
  payload: ProductCategoryCreate
): Promise<ProductCategory> {
  return apiRequest<ProductCategory>("/merchant/product-categories", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export async function updateMerchantProductCategory(
  token: string,
  id: number,
  payload: ProductCategoryUpdate
): Promise<ProductCategory> {
  return apiRequest<ProductCategory>(`/merchant/product-categories/${id}`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload)
  });
}

export async function deleteMerchantProductCategory(token: string, id: number): Promise<void> {
  await apiRequest<void>(`/merchant/product-categories/${id}`, {
    method: "DELETE",
    token
  });
}

export async function createMerchantProductSubcategory(
  token: string,
  payload: ProductSubcategoryCreate
): Promise<ProductSubcategory> {
  return apiRequest<ProductSubcategory>("/merchant/product-subcategories", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export async function updateMerchantProductSubcategory(
  token: string,
  id: number,
  payload: ProductSubcategoryUpdate
): Promise<ProductSubcategory> {
  return apiRequest<ProductSubcategory>(`/merchant/product-subcategories/${id}`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload)
  });
}

export async function deleteMerchantProductSubcategory(token: string, id: number): Promise<void> {
  await apiRequest<void>(`/merchant/product-subcategories/${id}`, {
    method: "DELETE",
    token
  });
}

export async function fetchMerchantProducts(token: string): Promise<Product[]> {
  return apiRequest<Product[]>("/merchant/products", { token });
}

export async function createMerchantProduct(token: string, payload: ProductWrite): Promise<Product> {
  return apiRequest<Product>("/merchant/products", { method: "POST", token, body: JSON.stringify(payload) });
}

export async function updateMerchantProduct(token: string, id: number, payload: ProductWrite): Promise<Product> {
  return apiRequest<Product>(`/merchant/products/${id}`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload)
  });
}

export async function deleteMerchantProduct(token: string, id: number): Promise<void> {
  await apiRequest<void>(`/merchant/products/${id}`, { method: "DELETE", token });
}

export async function fetchMerchantOrders(token: string): Promise<Order[]> {
  const orders = await apiRequest<RawOrder[]>("/merchant/orders", { token });
  return orders.map(mapOrder);
}

export async function updateMerchantOrderStatus(
  token: string,
  id: number,
  payload: OrderStatusUpdate
): Promise<Order> {
  return mapOrder(
    await apiRequest<RawOrder>(`/merchant/orders/${id}/status`, {
      method: "PUT",
      token,
      body: JSON.stringify(payload)
    })
  );
}

export async function fetchMerchantRiders(token: string): Promise<DeliveryProfile[]> {
  return apiRequest<DeliveryProfile[]>("/merchant/riders", { token });
}

export async function createMerchantRider(token: string, payload: MerchantRiderCreate): Promise<DeliveryProfile> {
  return apiRequest<DeliveryProfile>("/merchant/riders", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export async function updateMerchantRider(
  token: string,
  riderUserId: number,
  payload: MerchantRiderUpdate
): Promise<DeliveryProfile> {
  return apiRequest<DeliveryProfile>(`/merchant/riders/${riderUserId}`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload)
  });
}

export async function fetchMerchantRiderSettlements(token: string): Promise<DeliverySettlement[]> {
  return apiRequest<DeliverySettlement[]>("/merchant/riders/settlements", { token });
}

export async function createMerchantRiderSettlementPayment(
  token: string,
  payload: MerchantRiderSettlementPaymentCreate
): Promise<{ id: number; rider_user_id: number; store_id: number; amount: number; paid_at: string; reference: string | null; notes: string | null }> {
  return apiRequest<{
    id: number;
    rider_user_id: number;
    store_id: number;
    amount: number;
    paid_at: string;
    reference: string | null;
    notes: string | null;
  }>("/merchant/riders/settlements/payments", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export async function assignMerchantOrderRider(token: string, orderId: number, riderUserId: number): Promise<Order> {
  return mapOrder(
    await apiRequest<RawOrder>(`/merchant/orders/${orderId}/assign-rider`, {
      method: "POST",
      token,
      body: JSON.stringify({ rider_user_id: riderUserId })
    })
  );
}
