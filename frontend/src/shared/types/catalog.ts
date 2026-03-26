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

export type CategoryWrite = {
  name: string;
  description?: string | null;
  color: string;
  color_light?: string | null;
  icon?: string | null;
  is_active: boolean;
  sort_order: number;
};

export type StoreDeliverySettings = {
  delivery_enabled: boolean;
  pickup_enabled: boolean;
  delivery_fee: number;
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
