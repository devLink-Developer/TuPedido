import type { PricingSummary } from "./pricing";

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
