import type { StoreDetail } from "./catalog";
import type { Order } from "./order";

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
  min_order: number;
};

export type StorePaymentSettingsUpdate = {
  cash_enabled: boolean;
  mercadopago_enabled: boolean;
};

export type PlatformSettings = {
  service_fee_amount: number;
  catalog_banner_image_url?: string | null;
  catalog_banner_width?: number;
  catalog_banner_height?: number;
  updated_at?: string | null;
  updated_by?: string | null;
};

export type PlatformSettingsUpdate = {
  service_fee_amount: number;
  catalog_banner_image_url?: string | null;
  catalog_banner_width?: number;
  catalog_banner_height?: number;
};

export type MercadoPagoConnectResponse = {
  connect_url: string;
  callback_url?: string | null;
  status?: string | null;
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
};

export type SettlementCharge = {
  id: number;
  order_id: number;
  order_total: number;
  service_fee: number;
  payment_method: "cash" | "mercadopago";
  delivery_mode: "delivery" | "pickup";
  status: string;
  created_at: string;
  settled_at: string | null;
};

export type SettlementNotice = {
  id: number;
  store_id?: number;
  store_name?: string | null;
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
};

export type SettlementPayment = {
  id: number;
  store_id?: number;
  store_name?: string | null;
  amount: number;
  applied_amount: number;
  method: string;
  paid_at?: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
};

export type AdminSettlementStore = {
  id: number;
  store_name: string;
  owner_name: string;
  pending_balance: number;
  pending_charges_count: number;
  pending_notices_count: number;
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
  reference?: string | null;
  notes?: string | null;
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
  status: "approved" | "rejected" | "suspended";
};

export type MerchantStore = StoreDetail;
export type MerchantOrder = Order;
