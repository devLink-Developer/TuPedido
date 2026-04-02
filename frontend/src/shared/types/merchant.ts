import type { StoreDetail } from "./catalog";
import type { Order } from "./order";
import type { Promotion } from "./promotion";

export type Address = {
  id: number;
  label: string;
  postal_code: string | null;
  province: string | null;
  locality: string | null;
  street: string;
  details: string;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
};

export type AddressWrite = {
  label: string;
  postal_code?: string | null;
  province?: string | null;
  locality?: string | null;
  street: string;
  details: string;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
};

export type AddressLookupLocality = {
  name: string;
  latitude: number | null;
  longitude: number | null;
};

export type AddressPostalCodeLookup = {
  postal_code: string;
  province: string;
  localities: AddressLookupLocality[];
};

export type AddressGeocodeRequest = {
  postal_code: string;
  province: string;
  locality: string;
  street_name: string;
  street_number: string;
};

export type AddressGeocodeResult = {
  latitude: number;
  longitude: number;
  display_name: string | null;
};

export type AddressReverseGeocodeRequest = {
  latitude: number;
  longitude: number;
};

export type AddressReverseGeocodeResult = {
  street_name: string | null;
  street_number: string | null;
  display_name: string | null;
};

export type MerchantApplication = {
  id: number;
  business_name: string;
  description: string;
  address: string;
  phone: string;
  logo_url: string | null;
  cover_image_url: string | null;
  requested_category_ids: number[];
  requested_category_names: string[];
  status: string;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
  linked_store_slug: string | null;
};

export type MerchantApplicationCreate = {
  business_name: string;
  description: string;
  address: string;
  phone: string;
  logo_url?: string | null;
  cover_image_url?: string | null;
  requested_category_ids: number[];
};

export type MerchantApplicationRegister = {
  full_name: string;
  email: string;
  password: string;
  business_name: string;
  description: string;
  address: string;
  phone: string;
  requested_category_ids: number[];
};

export type AdminMerchantCreate = {
  full_name: string;
  email: string;
  password: string;
  business_name: string;
  description: string;
  address: string;
  phone: string;
  logo_url?: string | null;
  cover_image_url?: string | null;
  category_ids: number[];
  review_notes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  accepting_orders?: boolean;
  opening_note?: string | null;
  min_delivery_minutes?: number;
  max_delivery_minutes?: number;
  delivery_enabled?: boolean;
  pickup_enabled?: boolean;
  delivery_fee?: number;
  min_order?: number;
  cash_enabled?: boolean;
  mercadopago_enabled?: boolean;
};

export type StoreUpdate = {
  name: string;
  description: string;
  address: string;
  postal_code?: string | null;
  province?: string | null;
  locality?: string | null;
  phone: string;
  latitude?: number | null;
  longitude?: number | null;
  logo_url?: string | null;
  cover_image_url?: string | null;
  accepting_orders: boolean;
  opening_note?: string | null;
  min_delivery_minutes: number;
  max_delivery_minutes: number;
};

export type StoreCategoriesUpdate = {
  category_ids: number[];
};

export type StoreHourWrite = {
  day_of_week: number;
  opens_at: string | null;
  closes_at: string | null;
  is_closed: boolean;
};

export type StoreDeliverySettingsUpdate = {
  delivery_enabled: boolean;
  pickup_enabled: boolean;
  delivery_fee: number;
  free_delivery_min_order: number | null;
  rider_fee: number;
  min_order: number;
};

export type StorePaymentSettingsUpdate = {
  cash_enabled: boolean;
  mercadopago_enabled: boolean;
};

export type PlatformSettings = {
  service_fee_amount: number;
  platform_logo_url?: string | null;
  platform_wordmark_url?: string | null;
  platform_favicon_url?: string | null;
  platform_use_logo_as_favicon?: boolean;
  resolved_favicon_url?: string | null;
  catalog_banner_image_url?: string | null;
  catalog_banner_width?: number;
  catalog_banner_height?: number;
  updated_at?: string | null;
  updated_by?: string | null;
};

export type PlatformSettingsUpdate = {
  service_fee_amount: number;
  platform_logo_url?: string | null;
  platform_wordmark_url?: string | null;
  platform_favicon_url?: string | null;
  platform_use_logo_as_favicon?: boolean;
  catalog_banner_image_url?: string | null;
  catalog_banner_width?: number;
  catalog_banner_height?: number;
};

export type PaymentProviderConfig = {
  provider: "mercadopago";
  client_id: string | null;
  client_secret_masked: string | null;
  redirect_uri: string | null;
  enabled: boolean;
  mode: "sandbox" | "production";
  updated_at?: string | null;
};

export type PaymentProviderUpdate = {
  client_id?: string | null;
  client_secret?: string | null;
  redirect_uri?: string | null;
  enabled: boolean;
  mode: "sandbox" | "production";
};

export type MercadoPagoConnectResponse = {
  connect_url: string;
  connection_status?: string | null;
  callback_url?: string | null;
  status?: string | null;
};

export type MercadoPagoDisconnectResponse = {
  status: string;
};

export type SettlementOverview = {
  store_id: number;
  store_name: string;
  store_slug?: string | null;
  service_fee_amount?: number;
  pending_balance: number;
  paid_balance: number;
  pending_charges_count: number;
  open_charges_count?: number;
  pending_notices_count: number;
  charged_total?: number;
  paid_total?: number;
  last_charge_at: string | null;
  last_payment_at: string | null;
  payments?: SettlementPayment[];
};

export type SettlementCharge = {
  id: number;
  store_id?: number;
  order_id: number;
  order_status?: string;
  customer_name?: string;
  order_total: number;
  amount?: number;
  service_fee: number;
  allocated_amount?: number;
  outstanding_amount?: number;
  payment_method: "cash" | "mercadopago";
  delivery_mode: "delivery" | "pickup";
  status: string;
  created_at: string;
  order_created_at?: string;
  settled_at: string | null;
};

export type SettlementNotice = {
  id: number;
  store_id?: number;
  store_name?: string | null;
  store_slug?: string | null;
  amount: number;
  transfer_date: string;
  bank: string;
  reference: string;
  notes: string | null;
  proof_url?: string | null;
  proof_content_type?: string | null;
  proof_original_name?: string | null;
  status: string;
  created_at: string;
  reviewed_at?: string | null;
  reviewed_notes?: string | null;
  settlement_payment_id?: number | null;
};

export type SettlementAllocation = {
  charge_id: number;
  order_id: number;
  amount: number;
};

export type SettlementPayment = {
  id: number;
  store_id?: number;
  store_name?: string | null;
  store_slug?: string | null;
  notice_id?: number | null;
  source?: string;
  amount: number;
  applied_amount: number;
  method: string;
  paid_at?: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
  allocations?: SettlementAllocation[];
};

export type AdminSettlementStore = {
  id: number;
  store_id?: number;
  store_slug?: string;
  store_name: string;
  owner_name: string;
  pending_balance: number;
  pending_charges_count: number;
  open_charges_count?: number;
  pending_notices_count: number;
  charged_total?: number;
  paid_total?: number;
  last_charge_at?: string | null;
  last_activity_at: string | null;
  status?: string;
};

export type SettlementNoticeCreate = {
  amount: number;
  transfer_date: string;
  bank: string;
  reference: string;
  notes?: string | null;
  proof_url: string;
  proof_content_type: string;
  proof_original_name: string;
};

export type SettlementPaymentCreate = {
  store_id: number;
  amount: number;
  paid_at?: string | null;
  reference?: string | null;
  notes?: string | null;
};

export type RiderSettlementPayment = {
  id: number;
  rider_user_id: number;
  rider_name?: string | null;
  store_id: number | null;
  store_name?: string | null;
  source: string;
  amount: number;
  paid_at: string;
  reference: string | null;
  notes: string | null;
  receiver_status: "pending_confirmation" | "confirmed" | "disputed" | string;
  receiver_response_notes: string | null;
  receiver_responded_at: string | null;
  created_at: string;
};

export type SettlementHistoryEntry = {
  id: string;
  kind: "platform_charge" | "platform_notice" | "platform_payment" | "rider_payment" | string;
  store_id: number | null;
  store_name: string | null;
  rider_user_id: number | null;
  rider_name: string | null;
  title: string;
  status: string;
  amount: number;
  reference: string | null;
  notes: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export type ProductCategoryCreate = {
  name: string;
  sort_order: number;
};

export type ProductCategoryUpdate = ProductCategoryCreate;

export type ProductSubcategoryCreate = {
  product_category_id: number;
  name: string;
  sort_order: number;
};

export type ProductSubcategoryUpdate = ProductSubcategoryCreate;

export type ProductWrite = {
  product_category_id: number | null;
  product_subcategory_id: number | null;
  sku: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  unit_label: string | null;
  description: string;
  price: number;
  compare_at_price: number | null;
  commercial_discount_type: "percentage" | "fixed" | null;
  commercial_discount_value: number | null;
  image_url: string | null;
  stock_quantity: number | null;
  max_per_order: number | null;
  is_available: boolean;
  sort_order: number;
};

export type StoreStatusUpdate = {
  status: "approved" | "suspended";
};

export type MerchantStore = StoreDetail;
export type MerchantOrder = Order;
export type MerchantPromotion = Promotion;
