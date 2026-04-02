import type { StoreDeliverySettings } from "./catalog";
import type { PricingSummary } from "./pricing";
import type { AppliedPromotionSummary } from "./promotion";

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
  delivery_settings: StoreDeliverySettings;
  subtotal: number;
  commercial_discount_total: number;
  financial_discount_total: number;
  delivery_fee: number;
  service_fee: number;
  total: number;
  items: CartItem[];
  applied_promotions?: AppliedPromotionSummary[];
  pricing: PricingSummary;
};
