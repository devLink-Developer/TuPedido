export type PromotionItem = {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  sort_order: number;
};

export type PromotionItemWrite = {
  product_id: number;
  quantity: number;
  sort_order: number;
};

export type Promotion = {
  id: number;
  store_id: number;
  name: string;
  description: string | null;
  sale_price: number;
  max_per_customer_per_day: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  items: PromotionItem[];
};

export type PromotionWrite = {
  name: string;
  description?: string | null;
  sale_price: number;
  max_per_customer_per_day: number;
  is_active: boolean;
  sort_order: number;
  items: PromotionItemWrite[];
};

export type AppliedPromotionSummary = {
  promotion_id: number | null;
  promotion_name: string;
  combo_count: number;
  sale_price: number;
  base_total: number;
  discount_total: number;
  items: PromotionItem[];
};
