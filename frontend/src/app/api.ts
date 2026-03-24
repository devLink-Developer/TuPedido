import type {
  Address,
  AppNotification,
  AuthResponse,
  Cart,
  CartItem,
  CheckoutRequest,
  CheckoutResponse,
  Category,
  DeliveryApplication,
  DeliveryApplicationCreate,
  DeliveryProfile,
  DeliverySettlement,
  DeliverySettlementPaymentCreate,
  DeliveryZone,
  DeliveryZoneWrite,
  MerchantApplication,
  MerchantApplicationCreate,
  MerchantOrder,
  MerchantStore,
  AdminSettlementStore,
  Order,
  OrderTracking,
  OrderStatusUpdate,
  PaymentWebhookPayload,
  Product,
  ProductCategory,
  ProductCategoryCreate,
  ProductCategoryUpdate,
  ProductWrite,
  StoreCategoriesUpdate,
  StoreDeliverySettingsUpdate,
  StoreDetail,
  StoreHourWrite,
  StorePaymentSettingsUpdate,
  StoreStatusUpdate,
  StoreSummary,
  StoreUpdate,
  MercadoPagoConnectResponse,
  PlatformSettings,
  PlatformSettingsUpdate,
  SettlementOverview,
  SettlementCharge,
  SettlementChargeCreate,
  SettlementNotice,
  SettlementPayment,
  SettlementPaymentCreate,
  PushSubscriptionPayload
} from "./types";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8016/api/v1";

type RequestOptions = RequestInit & {
  token?: string | null;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : null;
  if (!response.ok) {
    const message = payload?.detail ?? payload?.message ?? `Request failed (${response.status})`;
    throw new Error(message);
  }

  return payload as T;
}

export function authHeaders(token: string | null | undefined): RequestOptions {
  return token ? { token } : {};
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export async function register(full_name: string, email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ full_name, email, password })
  });
}

export async function fetchMe(token: string): Promise<AuthResponse["user"]> {
  return request<AuthResponse["user"]>("/auth/me", { token });
}

export async function fetchAddresses(token: string): Promise<Address[]> {
  return request<Address[]>("/addresses", { token });
}

export async function createAddress(
  token: string,
  payload: Omit<Address, "id">
): Promise<Address> {
  return request<Address>("/addresses", { method: "POST", token, body: JSON.stringify(payload) });
}

export async function updateAddress(
  token: string,
  id: number,
  payload: Omit<Address, "id">
): Promise<Address> {
  return request<Address>(`/addresses/${id}`, { method: "PUT", token, body: JSON.stringify(payload) });
}

export async function deleteAddress(token: string, id: number): Promise<void> {
  await request<void>(`/addresses/${id}`, { method: "DELETE", token });
}

export async function fetchCategories(): Promise<Category[]> {
  return request<Category[]>("/catalog/categories");
}

export async function fetchStores(params: {
  categorySlug?: string;
  search?: string;
  deliveryMode?: string;
} = {}): Promise<StoreSummary[]> {
  const search = new URLSearchParams();
  if (params.categorySlug) search.set("category_slug", params.categorySlug);
  if (params.search) search.set("search", params.search);
  if (params.deliveryMode) search.set("delivery_mode", params.deliveryMode);
  const query = search.toString() ? `?${search.toString()}` : "";
  return request<StoreSummary[]>(`/catalog/stores${query}`);
}

export async function fetchStore(slug: string): Promise<StoreDetail> {
  return request<StoreDetail>(`/catalog/stores/${slug}`);
}

export async function fetchMerchantApplications(token: string): Promise<MerchantApplication[]> {
  return request<MerchantApplication[]>("/merchant-applications", { token });
}

export async function createMerchantApplication(
  token: string,
  payload: MerchantApplicationCreate
): Promise<MerchantApplication> {
  return request<MerchantApplication>("/merchant-applications", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export async function fetchAdminCategories(token: string): Promise<Category[]> {
  return request<Category[]>("/admin/categories", { token });
}

export async function createAdminCategory(token: string, payload: { name: string; description?: string | null }): Promise<Category> {
  return request<Category>("/admin/categories", { method: "POST", token, body: JSON.stringify(payload) });
}

export async function fetchAdminApplications(token: string): Promise<MerchantApplication[]> {
  return request<MerchantApplication[]>("/admin/stores/applications", { token });
}

export async function reviewMerchantApplication(
  token: string,
  applicationId: number,
  payload: { status: "approved" | "rejected" | "suspended"; review_notes?: string | null }
): Promise<MerchantApplication> {
  return request<MerchantApplication>(`/admin/stores/applications/${applicationId}`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload)
  });
}

export async function fetchAdminStores(token: string): Promise<StoreSummary[]> {
  return request<StoreSummary[]>("/admin/stores", { token });
}

export async function updateAdminStoreStatus(
  token: string,
  storeId: number,
  payload: StoreStatusUpdate
): Promise<StoreDetail> {
  return request<StoreDetail>(`/admin/stores/${storeId}/status`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload)
  });
}

export async function fetchAdminOrders(token: string): Promise<Order[]> {
  return request<Order[]>("/admin/orders", { token });
}

export async function fetchPlatformSettings(token: string): Promise<PlatformSettings> {
  return request<PlatformSettings>("/admin/platform-settings", { token });
}

export async function updatePlatformSettings(token: string, payload: PlatformSettingsUpdate): Promise<PlatformSettings> {
  return request<PlatformSettings>("/admin/platform-settings", {
    method: "PUT",
    token,
    body: JSON.stringify(payload)
  });
}

export async function fetchAdminSettlementStores(token: string): Promise<AdminSettlementStore[]> {
  return request<AdminSettlementStore[]>("/admin/settlements/stores", { token });
}

export async function fetchAdminSettlementNotices(token: string): Promise<SettlementNotice[]> {
  return request<SettlementNotice[]>("/admin/settlements/notices", { token });
}

export async function reviewAdminSettlementNotice(
  token: string,
  id: number,
  payload: { status: "approved" | "rejected" | "pending"; review_notes?: string | null }
): Promise<SettlementNotice> {
  return request<SettlementNotice>(`/admin/settlements/notices/${id}`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload)
  });
}

export async function fetchAdminSettlementPayments(token: string): Promise<SettlementPayment[]> {
  return request<SettlementPayment[]>("/admin/settlements/payments", { token });
}

export async function createAdminSettlementPayment(
  token: string,
  payload: SettlementPaymentCreate
): Promise<SettlementPayment> {
  return request<SettlementPayment>("/admin/settlements/payments", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export async function fetchCart(token: string): Promise<Cart> {
  return request<Cart>("/cart", { token });
}

export async function updateCart(token: string, delivery_mode: "delivery" | "pickup"): Promise<Cart> {
  return request<Cart>("/cart", { method: "PUT", token, body: JSON.stringify({ delivery_mode }) });
}

export async function addCartItem(
  token: string,
  payload: { store_id: number; product_id: number; quantity?: number; note?: string | null }
): Promise<Cart> {
  return request<Cart>("/cart/items", { method: "POST", token, body: JSON.stringify(payload) });
}

export async function updateCartItem(
  token: string,
  itemId: number,
  payload: { quantity: number; note?: string | null }
): Promise<Cart> {
  return request<Cart>(`/cart/items/${itemId}`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload)
  });
}

export async function removeCartItem(token: string, itemId: number): Promise<Cart> {
  return request<Cart>(`/cart/items/${itemId}`, { method: "DELETE", token });
}

export async function clearCart(token: string): Promise<Cart> {
  return request<Cart>("/cart", { method: "DELETE", token });
}

export async function checkout(token: string, payload: CheckoutRequest): Promise<CheckoutResponse> {
  return request<CheckoutResponse>("/checkout", { method: "POST", token, body: JSON.stringify(payload) });
}

export async function fetchOrders(token: string): Promise<Order[]> {
  return request<Order[]>("/orders", { token });
}

export async function fetchOrder(token: string, id: number): Promise<Order> {
  return request<Order>(`/orders/${id}`, { token });
}

export async function fetchOrderTracking(token: string, id: number): Promise<OrderTracking> {
  return request<OrderTracking>(`/orders/${id}/tracking`, { token });
}

export async function fetchMerchantStore(token: string): Promise<MerchantStore> {
  return request<MerchantStore>("/merchant/store", { token });
}

export async function updateMerchantStore(token: string, payload: StoreUpdate): Promise<MerchantStore> {
  return request<MerchantStore>("/merchant/store", { method: "PUT", token, body: JSON.stringify(payload) });
}

export async function updateMerchantStoreCategories(
  token: string,
  payload: StoreCategoriesUpdate
): Promise<MerchantStore> {
  return request<MerchantStore>("/merchant/store/categories", { method: "PUT", token, body: JSON.stringify(payload) });
}

export async function updateMerchantStoreHours(
  token: string,
  payload: { hours: StoreHourWrite[] }
): Promise<MerchantStore> {
  return request<MerchantStore>("/merchant/store/hours", { method: "PUT", token, body: JSON.stringify(payload) });
}

export async function updateMerchantDeliverySettings(
  token: string,
  payload: StoreDeliverySettingsUpdate
): Promise<MerchantStore> {
  return request<MerchantStore>("/merchant/store/delivery-settings", {
    method: "PUT",
    token,
    body: JSON.stringify(payload)
  });
}

export async function updateMerchantPaymentSettings(
  token: string,
  payload: StorePaymentSettingsUpdate
): Promise<MerchantStore> {
  return request<MerchantStore>("/merchant/store/payment-settings", {
    method: "PUT",
    token,
    body: JSON.stringify(payload)
  });
}

export async function fetchMerchantMercadoPagoConnectUrl(token: string): Promise<MercadoPagoConnectResponse> {
  return request<MercadoPagoConnectResponse>("/merchant/payments/mercadopago/connect-url", { token });
}

export async function fetchMerchantSettlementOverview(token: string): Promise<SettlementOverview> {
  return request<SettlementOverview>("/merchant/settlements/overview", { token });
}

export async function fetchMerchantSettlementCharges(token: string): Promise<SettlementCharge[]> {
  return request<SettlementCharge[]>("/merchant/settlements/charges", { token });
}

export async function fetchMerchantSettlementNotices(token: string): Promise<SettlementNotice[]> {
  return request<SettlementNotice[]>("/merchant/settlements/notices", { token });
}

export async function createMerchantSettlementNotice(
  token: string,
  payload: SettlementChargeCreate
): Promise<SettlementNotice> {
  return request<SettlementNotice>("/merchant/settlements/notices", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export async function fetchMerchantProductCategories(token: string): Promise<ProductCategory[]> {
  return request<ProductCategory[]>("/merchant/product-categories", { token });
}

export async function createMerchantProductCategory(
  token: string,
  payload: ProductCategoryCreate
): Promise<ProductCategory> {
  return request<ProductCategory>("/merchant/product-categories", {
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
  return request<ProductCategory>(`/merchant/product-categories/${id}`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload)
  });
}

export async function fetchMerchantProducts(token: string): Promise<Product[]> {
  return request<Product[]>("/merchant/products", { token });
}

export async function createMerchantProduct(token: string, payload: ProductWrite): Promise<Product> {
  return request<Product>("/merchant/products", { method: "POST", token, body: JSON.stringify(payload) });
}

export async function updateMerchantProduct(token: string, id: number, payload: ProductWrite): Promise<Product> {
  return request<Product>(`/merchant/products/${id}`, { method: "PUT", token, body: JSON.stringify(payload) });
}

export async function deleteMerchantProduct(token: string, id: number): Promise<void> {
  await request<void>(`/merchant/products/${id}`, { method: "DELETE", token });
}

export async function fetchMerchantOrders(token: string): Promise<Order[]> {
  return request<Order[]>("/merchant/orders", { token });
}

export async function updateMerchantOrderStatus(
  token: string,
  id: number,
  payload: OrderStatusUpdate
): Promise<Order> {
  return request<Order>(`/merchant/orders/${id}/status`, { method: "PUT", token, body: JSON.stringify(payload) });
}

export async function fetchDeliveryApplications(token: string): Promise<DeliveryApplication[]> {
  return request<DeliveryApplication[]>("/delivery-applications", { token });
}

export async function createDeliveryApplication(
  token: string,
  payload: DeliveryApplicationCreate
): Promise<DeliveryApplication> {
  return request<DeliveryApplication>("/delivery-applications", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export async function fetchAdminDeliveryApplications(token: string): Promise<DeliveryApplication[]> {
  return request<DeliveryApplication[]>("/admin/delivery-applications", { token });
}

export async function reviewAdminDeliveryApplication(
  token: string,
  applicationId: number,
  payload: { status: "pending_review" | "approved" | "rejected" | "suspended"; review_notes?: string | null }
): Promise<DeliveryApplication> {
  return request<DeliveryApplication>(`/admin/delivery-applications/${applicationId}`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload)
  });
}

export async function fetchAdminDeliveryRiders(token: string): Promise<DeliveryProfile[]> {
  return request<DeliveryProfile[]>("/admin/delivery/riders", { token });
}

export async function fetchAdminDeliveryZones(token: string): Promise<DeliveryZone[]> {
  return request<DeliveryZone[]>("/admin/delivery/zones", { token });
}

export async function createAdminDeliveryZone(token: string, payload: DeliveryZoneWrite): Promise<DeliveryZone> {
  return request<DeliveryZone>("/admin/delivery/zones", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export async function updateAdminDeliveryZone(token: string, zoneId: number, payload: DeliveryZoneWrite): Promise<DeliveryZone> {
  return request<DeliveryZone>(`/admin/delivery/zones/${zoneId}`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload)
  });
}

export async function fetchAdminDeliveryDispatch(token: string): Promise<Order[]> {
  return request<Order[]>("/admin/delivery/dispatch", { token });
}

export async function assignAdminDeliveryOrder(token: string, orderId: number, rider_user_id: number): Promise<Order> {
  return request<Order>(`/admin/delivery/dispatch/${orderId}/assign`, {
    method: "PUT",
    token,
    body: JSON.stringify({ rider_user_id })
  });
}

export async function fetchAdminDeliverySettlements(token: string): Promise<DeliverySettlement[]> {
  return request<DeliverySettlement[]>("/admin/delivery/settlements", { token });
}

export async function createAdminDeliverySettlementPayment(
  token: string,
  payload: DeliverySettlementPaymentCreate
): Promise<{ id: number }> {
  return request<{ id: number }>("/admin/delivery/settlements/payments", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export async function fetchDeliveryMe(token: string): Promise<DeliveryProfile> {
  return request<DeliveryProfile>("/delivery/me", { token });
}

export async function updateDeliveryAvailability(
  token: string,
  payload: { availability: "offline" | "idle" | "reserved" | "delivering" | "paused"; zone_id?: number | null }
): Promise<DeliveryProfile> {
  return request<DeliveryProfile>("/delivery/me/availability", {
    method: "PUT",
    token,
    body: JSON.stringify(payload)
  });
}

export async function fetchDeliveryOrders(token: string): Promise<Order[]> {
  return request<Order[]>("/delivery/me/orders", { token });
}

export async function acceptDeliveryOrder(token: string, orderId: number): Promise<Order> {
  return request<Order>(`/delivery/me/orders/${orderId}/accept`, { method: "POST", token });
}

export async function pickupDeliveryOrder(token: string, orderId: number): Promise<Order> {
  return request<Order>(`/delivery/me/orders/${orderId}/pickup`, { method: "POST", token });
}

export async function deliverDeliveryOrder(token: string, orderId: number, otp_code?: string | null): Promise<Order> {
  return request<Order>(`/delivery/me/orders/${orderId}/deliver`, {
    method: "POST",
    token,
    body: JSON.stringify({ otp_code: otp_code ?? null })
  });
}

export async function pushDeliveryLocation(
  token: string,
  payload: {
    order_id: number;
    latitude: number;
    longitude: number;
    heading?: number | null;
    speed_kmh?: number | null;
    accuracy_meters?: number | null;
  }
): Promise<Order> {
  return request<Order>("/delivery/me/location", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export async function fetchDeliveryNotifications(token: string): Promise<AppNotification[]> {
  return request<AppNotification[]>("/delivery/me/notifications", { token });
}

export async function fetchDeliverySettlements(token: string): Promise<DeliverySettlement> {
  return request<DeliverySettlement>("/delivery/me/settlements", { token });
}

export async function fetchNotifications(token: string): Promise<AppNotification[]> {
  return request<AppNotification[]>("/notifications", { token });
}

export async function markNotificationRead(token: string, notificationId: number): Promise<AppNotification> {
  return request<AppNotification>(`/notifications/${notificationId}/read`, { method: "PUT", token });
}

export async function registerPushSubscription(token: string, payload: PushSubscriptionPayload): Promise<{ id: number }> {
  return request<{ id: number }>("/notifications/push-subscriptions", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export function buildOrderSocketUrl(token: string, orderId: number): string {
  const baseUrl = new URL(API_BASE_URL);
  baseUrl.protocol = baseUrl.protocol === "https:" ? "wss:" : "ws:";
  baseUrl.pathname = `${baseUrl.pathname.replace(/\/api\/v1$/, "")}/api/v1/ws/orders/${orderId}`;
  baseUrl.search = `token=${encodeURIComponent(token)}`;
  return baseUrl.toString();
}

export function buildDeliverySocketUrl(token: string): string {
  const baseUrl = new URL(API_BASE_URL);
  baseUrl.protocol = baseUrl.protocol === "https:" ? "wss:" : "ws:";
  baseUrl.pathname = `${baseUrl.pathname.replace(/\/api\/v1$/, "")}/api/v1/ws/delivery/me`;
  baseUrl.search = `token=${encodeURIComponent(token)}`;
  return baseUrl.toString();
}

export async function submitMercadoPagoWebhook(
  payload: PaymentWebhookPayload
): Promise<Order> {
  return request<Order>("/payments/mercadopago/webhook", { method: "POST", body: JSON.stringify(payload) });
}
