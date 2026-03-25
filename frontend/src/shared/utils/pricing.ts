import type { PricingSummary } from "../types";

type PricingSource = {
  subtotal?: number | null;
  commercial_discount_total?: number | null;
  financial_discount_total?: number | null;
  delivery_fee?: number | null;
  delivery_fee_customer?: number | null;
  service_fee?: number | null;
  total?: number | null;
  pricing?:
    | (Partial<PricingSummary> & {
        commercial_discount_total?: number | null;
        financial_discount_total?: number | null;
        delivery_fee?: number | null;
        service_fee?: number | null;
      })
    | null;
};

export function buildPricingSummary(source: PricingSource): PricingSummary {
  const incoming = source.pricing ?? null;
  return {
    subtotal: incoming?.subtotal ?? source.subtotal ?? null,
    commercialDiscountTotal:
      incoming?.commercialDiscountTotal ?? incoming?.commercial_discount_total ?? source.commercial_discount_total ?? null,
    financialDiscountTotal:
      incoming?.financialDiscountTotal ?? incoming?.financial_discount_total ?? source.financial_discount_total ?? null,
    deliveryFee: incoming?.deliveryFee ?? incoming?.delivery_fee ?? source.delivery_fee_customer ?? source.delivery_fee ?? null,
    serviceFee: incoming?.serviceFee ?? incoming?.service_fee ?? source.service_fee ?? null,
    total: incoming?.total ?? source.total ?? null,
    complete:
      incoming?.subtotal !== undefined &&
      (incoming?.commercialDiscountTotal !== undefined || incoming?.commercial_discount_total !== undefined) &&
      (incoming?.financialDiscountTotal !== undefined || incoming?.financial_discount_total !== undefined) &&
      (incoming?.deliveryFee !== undefined || incoming?.delivery_fee !== undefined) &&
      (incoming?.serviceFee !== undefined || incoming?.service_fee !== undefined) &&
      incoming?.total !== undefined
  };
}

export function isPricingComplete(pricing: PricingSummary | null | undefined) {
  return Boolean(pricing?.complete);
}
