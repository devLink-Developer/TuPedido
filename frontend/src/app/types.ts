export type Role = "customer" | "merchant" | "admin" | "delivery";

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

export type Address = {
  id: number;
  label: string;
  street: string;
  details: string;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
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
  mercadopago_public_key_masked: string | null;
  mercadopago_connection_status?: string | null;
  mercadopago_reconnect_required?: boolean;
};

export type StoreSummary = {
  id: number;
  slug: string;
  name: string;
  description: string;
  address: string;
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
};

export type Product = {
  id: number;
  store_id: number;
  product_category_id: number | null;
  product_category_name: string | null;
  name: string;
  description: string;
  price: number;
  compare_at_price: number | null;
  image_url: string | null;
  is_available: boolean;
  sort_order: number;
};

export type StoreDetail = StoreSummary & {
  product_categories: ProductCategory[];
  products: Product[];
  hours: StoreHour[];
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

export type CartItem = {
  id: number;
  product_id: number;
  product_name: string;
  unit_price: number;
  quantity: number;
  note: string | null;
};

export type Cart = {
  id: number;
  store_id: number | null;
  store_name: string | null;
  store_slug: string | null;
  delivery_mode: "delivery" | "pickup";
  subtotal: number;
  delivery_fee: number;
  service_fee: number;
  total: number;
  items: CartItem[]; 
};

export type OrderItem = {
  id: number;
  product_id: number | null;
  product_name: string;
  quantity: number;
  unit_price: number;
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
  created_at: string;
  items: OrderItem[];
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

export type CheckoutResponse = {
  order_id: number;
  status: string;
  payment_status: string;
  payment_reference: string | null;
  checkout_url: string | null;
};

export type CheckoutRequest = {
  store_id: number;
  address_id: number | null;
  delivery_mode: "delivery" | "pickup";
  payment_method: "cash" | "mercadopago";
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

export type StoreUpdate = {
  name: string;
  description: string;
  address: string;
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

export type StoreHoursUpdate = {
  hours: StoreHourWrite[];
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

export type MercadoPagoConnectResponse = {
  connect_url: string;
  callback_url?: string | null;
  status?: string | null;
};

export type SettlementOverview = {
  store_id: number;
  store_name: string;
  service_fee_amount?: number;
  pending_balance: number;
  paid_balance: number;
  pending_charges_count: number;
  pending_notices_count: number;
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

export type ProductWrite = {
  product_category_id: number | null;
  name: string;
  description: string;
  price: number;
  compare_at_price: number | null;
  image_url: string | null;
  is_available: boolean;
  sort_order: number;
};

export type StoreStatusUpdate = {
  status: "approved" | "suspended";
};

export type OrderStatusUpdate = {
  status:
    | "created"
    | "accepted"
    | "preparing"
    | "ready_for_dispatch"
    | "ready_for_pickup"
    | "out_for_delivery"
    | "delivered"
    | "cancelled"
    | "delivery_failed";
};

export type PaymentWebhookPayload = {
  reference: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
};

export type MerchantStore = StoreDetail;
export type MerchantOrder = Order;

export type DeliveryVehicleType = "bicycle" | "motorcycle" | "car";
export type DeliveryAvailability = "offline" | "idle" | "reserved" | "delivering" | "paused";

export type DeliveryApplication = {
  id: number;
  user_id: number;
  store_id: number | null;
  store_name: string | null;
  user_name: string;
  user_email: string;
  phone: string;
  vehicle_type: DeliveryVehicleType;
  photo_url: string | null;
  dni_number: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  license_number: string | null;
  vehicle_plate: string | null;
  insurance_policy: string | null;
  notes: string | null;
  status: "pending_review" | "approved" | "rejected" | "suspended";
  review_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DeliveryApplicationCreate = {
  phone: string;
  vehicle_type: DeliveryVehicleType;
  photo_url?: string | null;
  dni_number: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  license_number?: string | null;
  vehicle_plate?: string | null;
  insurance_policy?: string | null;
  notes?: string | null;
};

export type DeliveryProfile = {
  user_id: number;
  store_id: number | null;
  store_name: string | null;
  full_name: string;
  email: string;
  phone: string;
  vehicle_type: DeliveryVehicleType;
  photo_url: string | null;
  dni_number: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
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
  rating: number;
  push_enabled: boolean;
};

export type DeliveryZoneRate = {
  vehicle_type: DeliveryVehicleType;
  delivery_fee_customer: number;
  rider_fee: number;
};

export type DeliveryZone = {
  id: number;
  name: string;
  description: string | null;
  center_latitude: number;
  center_longitude: number;
  radius_km: number;
  is_active: boolean;
  rates: DeliveryZoneRate[];
};

export type DeliveryZoneWrite = Omit<DeliveryZone, "id">;

export type DeliverySettlement = {
  rider_user_id: number;
  rider_name: string;
  vehicle_type: string;
  cash_liability_total: number;
  cash_liability_open: number;
  rider_fee_earned_total: number;
  rider_fee_paid_total: number;
  pending_amount: number;
  merchant_cash_payable_total?: number;
};

export type DeliverySettlementPaymentCreate = {
  rider_user_id: number;
  amount: number;
  paid_at: string;
  reference?: string | null;
  notes?: string | null;
};

export type AppNotification = {
  id: number;
  order_id: number | null;
  channel: string;
  event_type: string;
  title: string;
  body: string;
  payload_json: string | null;
  is_read: boolean;
  push_status: string;
  created_at: string;
};

export type PushSubscriptionPayload = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  user_agent?: string | null;
};

export type LegacyRestaurant = {
  id: string;
  slug: string;
  name: string;
  cuisine: string;
  description: string;
  eta: string;
  rating: number;
  deliveryFee: string;
  coverImage: string;
  accent: string;
};

export type MenuCategory = {
  id: string;
  name: string;
};

export type LegacyProduct = {
  id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
};

export type LegacyAddress = {
  id: string;
  label: string;
  street: string;
  details: string;
  isDefault?: boolean;
};

export type LegacyCartItem = {
  productId: string;
  quantity: number;
};

export type Restaurant = LegacyRestaurant;
export type LegacyCart = LegacyCartItem;
