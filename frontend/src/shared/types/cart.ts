import type { PricingSummary } from "./pricing";

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
  pricing: PricingSummary;
};
