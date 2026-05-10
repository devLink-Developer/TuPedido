export type Role = "customer" | "merchant" | "delivery" | "admin";

export type AuthUser = {
  id: number;
  full_name: string;
  email: string;
  role: Role;
  is_active: boolean;
  must_change_password?: boolean;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  user: AuthUser;
};

export type Category = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  color_light: string;
  icon: string | null;
  is_active: boolean;
  sort_order: number;
};

export type CatalogBanner = {
  catalog_banner_image_url: string | null;
  catalog_banner_width: number;
  catalog_banner_height: number;
};

export type PlatformBranding = {
  platform_logo_url: string | null;
  platform_wordmark_url: string | null;
  platform_favicon_url: string | null;
  platform_use_logo_as_favicon: boolean;
  resolved_favicon_url: string | null;
};

export type StoreDeliverySettings = {
  delivery_enabled: boolean;
  pickup_enabled: boolean;
  delivery_fee: number;
  free_delivery_min_order: number | null;
  rider_fee: number;
  min_order: number;
};

export type StorePaymentSettings = {
  cash_enabled: boolean;
  mercadopago_enabled: boolean;
  mercadopago_configured: boolean;
  mercadopago_provider_enabled: boolean;
  mercadopago_provider_mode: string;
  mercadopago_public_key_masked: string | null;
  mercadopago_connection_status?: "connected" | "disconnected" | "reconnect_required" | "onboarding_pending" | null;
  mercadopago_reconnect_required?: boolean;
  mercadopago_onboarding_completed?: boolean;
  mercadopago_oauth_connected_at?: string | null;
  mercadopago_mp_user_id?: string | null;
};

export type StoreSummary = {
  id: number;
  slug: string;
  name: string;
  description: string;
  address: string;
  postal_code?: string | null;
  province?: string | null;
  locality?: string | null;
  phone: string;
  latitude: number | null;
  longitude: number | null;
  logo_url: string | null;
  cover_image_url: string | null;
  status: string;
  accepting_orders: boolean;
  is_open: boolean;
  opening_note: string | null;
  min_delivery_minutes: number;
  max_delivery_minutes: number;
  rating: number;
  rating_count: number;
  category_ids?: number[];
  primary_category_id?: number | null;
  primary_category: string | null;
  primary_category_slug?: string | null;
  categories: string[];
  delivery_settings: StoreDeliverySettings;
  payment_settings: StorePaymentSettings;
};

export type StoreHour = {
  day_of_week: number;
  opens_at: string | null;
  closes_at: string | null;
  is_closed: boolean;
};

export type ProductCategory = {
  id: number;
  name: string;
  slug: string;
  sort_order: number;
  subcategories: ProductSubcategory[];
};

export type ProductSubcategory = {
  id: number;
  product_category_id: number;
  name: string;
  slug: string;
  sort_order: number;
};

export type Product = {
  id: number;
  store_id: number;
  product_category_id: number | null;
  product_category_name: string | null;
  product_subcategory_id: number | null;
  product_subcategory_name: string | null;
  sku: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  unit_label: string | null;
  description: string;
  price: number;
  compare_at_price: number | null;
  final_price: number;
  commercial_discount_type: "percentage" | "fixed" | null;
  commercial_discount_value: number | null;
  commercial_discount_amount: number;
  commercial_discount_percentage: number;
  has_commercial_discount: boolean;
  image_url: string | null;
  stock_quantity: number | null;
  max_per_order: number | null;
  is_available: boolean;
  sort_order: number;
};

export type StoreDetail = StoreSummary & {
  product_categories: ProductCategory[];
  products: Product[];
  hours: StoreHour[];
};

export type Address = {
  id: number;
  label: string;
  postal_code: string;
  province: string;
  locality: string;
  street: string;
  details: string | null;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
};

export type AddressWrite = {
  label: string;
  postal_code: string;
  province: string;
  locality: string;
  street: string;
  details: string;
  latitude: number;
  longitude: number;
  is_default: boolean;
};

export type PostalCodeLookup = {
  postal_code: string;
  province: string;
  localities: Array<{
    name: string;
    latitude: number | null;
    longitude: number | null;
  }>;
};

export type PricingSummary = {
  subtotal: number;
  commercial_discount_total: number;
  financial_discount_total: number;
  delivery_fee: number;
  service_fee: number;
  total: number;
};

export type CartItem = {
  id: number;
  product_id: number;
  product_name: string;
  base_unit_price: number;
  unit_price: number;
  commercial_discount_amount: number;
  quantity: number;
  note: string | null;
};

export type Cart = {
  id: number;
  store_id: number | null;
  store_name: string | null;
  store_slug: string | null;
  delivery_mode: "delivery" | "pickup";
  delivery_settings: StoreDeliverySettings | null;
  subtotal: number;
  commercial_discount_total: number;
  financial_discount_total: number;
  delivery_fee: number;
  service_fee: number;
  total: number;
  pricing: PricingSummary;
  items: CartItem[];
  applied_promotions?: AppliedPromotionSummary[];
};

export type AppliedPromotionSummary = {
  id?: number;
  name?: string;
  discount_amount?: number;
  [key: string]: unknown;
};

export type CheckoutRequest = {
  store_id: number;
  address_id: number | null;
  delivery_mode: "delivery" | "pickup";
  payment_method: "cash" | "mercadopago";
  idempotency_key?: string | null;
};

export type CheckoutResponse = {
  order_id: number;
  status: string;
  payment_status: string;
  payment_reference: string | null;
  payment_transaction_id: number | null;
  provider_preference_id: string | null;
  checkout_url: string | null;
};

export type OrderItem = {
  id: number;
  product_id: number | null;
  product_name: string;
  base_unit_price: number;
  quantity: number;
  unit_price: number;
  commercial_discount_amount: number;
  note: string | null;
};

export type Order = {
  id: number;
  store_id: number;
  store_name: string;
  store_slug: string;
  customer_name: string;
  delivery_mode: "delivery" | "pickup";
  payment_method: "cash" | "mercadopago";
  payment_status: string;
  payment_reference: string | null;
  status: string;
  address_label: string | null;
  address_full: string | null;
  store_latitude: number | null;
  store_longitude: number | null;
  address_latitude: number | null;
  address_longitude: number | null;
  subtotal: number;
  commercial_discount_total: number;
  financial_discount_total: number;
  delivery_fee: number;
  service_fee: number;
  delivery_fee_customer: number;
  rider_fee: number;
  total: number;
  delivery_status: string;
  delivery_provider: string;
  delivery_zone_id: number | null;
  assigned_rider_id: number | null;
  assigned_rider_name: string | null;
  assigned_rider_phone_masked: string | null;
  assigned_rider_vehicle_type: string | null;
  tracking_last_latitude: number | null;
  tracking_last_longitude: number | null;
  tracking_last_at: string | null;
  tracking_stale: boolean;
  eta_minutes: number | null;
  otp_required: boolean;
  merchant_ready_at: string | null;
  out_for_delivery_at: string | null;
  delivered_at: string | null;
  updated_at: string | null;
  created_at: string;
  items: OrderItem[];
  applied_promotions?: AppliedPromotionSummary[];
  pricing: PricingSummary;
};

export type OrderTracking = {
  order_id: number;
  status: string;
  delivery_status: string;
  delivery_provider: string;
  tracking_enabled: boolean;
  assigned_rider_id: number | null;
  assigned_rider_name: string | null;
  assigned_rider_phone_masked: string | null;
  assigned_rider_vehicle_type: string | null;
  store_latitude: number | null;
  store_longitude: number | null;
  address_latitude: number | null;
  address_longitude: number | null;
  tracking_last_latitude: number | null;
  tracking_last_longitude: number | null;
  tracking_last_at: string | null;
  tracking_stale: boolean;
  eta_minutes: number | null;
  otp_required: boolean;
  otp_code: string | null;
};

export type RouteProfile = "driving-car" | "cycling-regular" | "foot-walking";

export type RouteCoordinate = {
  latitude: number;
  longitude: number;
};

export type DirectionsRequest = {
  profile?: RouteProfile;
  coordinates: RouteCoordinate[];
};

export type DirectionsRead = {
  provider: "openrouteservice";
  profile: RouteProfile;
  distance_meters: number;
  duration_seconds: number;
  duration_minutes: number;
  geometry: RouteCoordinate[];
};

export type PaymentTransaction = {
  id: number;
  order_id: number;
  provider: string;
  external_reference: string;
  preference_id: string | null;
  payment_id: string | null;
  status: string;
  status_detail: string | null;
  amount_total: number;
  currency: string;
  requested_marketplace_fee: number;
  approved_marketplace_fee: number | null;
  seller_expected_amount: number;
  delivery_fee_amount: number;
  service_fee_amount: number;
  mp_user_id: string | null;
  live_mode: boolean | null;
  checkout_url: string | null;
  created_at: string;
  updated_at: string | null;
};

export type PendingOrderReview = {
  order_id: number;
  store_name: string;
  delivered_at: string | null;
  rider_name: string | null;
  requires_rider_rating: boolean;
};

export type CreateOrderReviewPayload = {
  store_rating: number;
  rider_rating?: number | null;
  review_text?: string | null;
};

export type AppNotification = {
  id: number;
  order_id: number | null;
  channel: string;
  event_type: string;
  title: string;
  body: string;
  payload_json: unknown;
  is_read: boolean;
  push_status: string;
  created_at: string;
};

export type DeliveryAvailability = "offline" | "idle" | "reserved" | "delivering" | "paused";

export type DeliveryProfile = {
  user_id: number;
  store_id: number | null;
  store_name: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  vehicle_type: "bicycle" | "motorcycle" | "car" | string | null;
  photo_url: string | null;
  dni_number: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  license_number: string | null;
  vehicle_plate: string | null;
  insurance_policy: string | null;
  notes: string | null;
  availability: DeliveryAvailability;
  is_active: boolean;
  current_zone_id: number | null;
  current_latitude: number | null;
  current_longitude: number | null;
  last_location_at: string | null;
  completed_deliveries: number;
  rating: number | null;
  push_enabled: boolean;
};

export type DeliverySettlement = {
  rider_user_id: number;
  rider_name: string;
  vehicle_type: string | null;
  cash_liability_total: number;
  cash_liability_open: number;
  rider_fee_earned_total: number;
  rider_fee_paid_total: number;
  pending_amount: number;
  merchant_cash_payable_total: number;
};

export type DeliverySettlementPayment = {
  id: number;
  rider_user_id: number;
  store_id: number | null;
  store_name: string | null;
  amount: number;
  paid_at: string | null;
  reference: string | null;
  notes: string | null;
  receiver_status: "pending_confirmation" | "confirmed" | "disputed" | string;
  receiver_response_notes: string | null;
  receiver_responded_at: string | null;
  created_at: string;
};

export type DeliveryLocationPayload = {
  order_id: number;
  latitude: number;
  longitude: number;
  heading?: number | null;
  speed_kmh?: number | null;
  accuracy_meters?: number | null;
};
