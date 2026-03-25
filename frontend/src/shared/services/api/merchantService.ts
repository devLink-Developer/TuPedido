import type {
  MercadoPagoConnectResponse,
  MerchantStore,
  Order,
  OrderStatusUpdate,
  Product,
  ProductCategory,
  ProductCategoryCreate,
  ProductCategoryUpdate,
  ProductWrite,
  SettlementCharge,
  SettlementChargeCreate,
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
  return apiRequest<MercadoPagoConnectResponse>("/merchant/payments/mercadopago/connect-url", { token });
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
  payload: SettlementChargeCreate
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
