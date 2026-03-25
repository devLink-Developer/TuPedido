import type { PricingSummary } from "../types";

type PricingSource = {
  subtotal?: number | null;
  delivery_fee?: number | null;
  delivery_fee_customer?: number | null;
  service_fee?: number | null;
  total?: number | null;
  pricing?: Partial<PricingSummary> | null;
};

export function buildPricingSummary(source: PricingSource): PricingSummary {
  const incoming = source.pricing ?? null;
  return {
    subtotal: incoming?.subtotal ?? source.subtotal ?? null,
    commercialDiscountTotal: incoming?.commercialDiscountTotal ?? null,
    financialDiscountTotal: incoming?.financialDiscountTotal ?? null,
    deliveryFee: incoming?.deliveryFee ?? source.delivery_fee_customer ?? source.delivery_fee ?? null,
    serviceFee: incoming?.serviceFee ?? source.service_fee ?? null,
    total: incoming?.total ?? source.total ?? null,
    complete:
      incoming?.subtotal !== undefined &&
      incoming?.commercialDiscountTotal !== undefined &&
      incoming?.financialDiscountTotal !== undefined &&
      incoming?.deliveryFee !== undefined &&
      incoming?.serviceFee !== undefined &&
      incoming?.total !== undefined
  };
}

export function isPricingComplete(pricing: PricingSummary | null | undefined) {
  return Boolean(pricing?.complete);
}
