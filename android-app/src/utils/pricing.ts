import type { Cart, Order, PricingSummary } from "../types/api";

type PricingInput = Pick<
  Cart | Order,
  | "subtotal"
  | "commercial_discount_total"
  | "financial_discount_total"
  | "delivery_fee"
  | "service_fee"
  | "total"
> & {
  pricing?: Partial<PricingSummary> | null;
};

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function buildPricingSummary(input: PricingInput): PricingSummary {
  return {
    subtotal: numberOrZero(input.pricing?.subtotal ?? input.subtotal),
    commercial_discount_total: numberOrZero(input.pricing?.commercial_discount_total ?? input.commercial_discount_total),
    financial_discount_total: numberOrZero(input.pricing?.financial_discount_total ?? input.financial_discount_total),
    delivery_fee: numberOrZero(input.pricing?.delivery_fee ?? input.delivery_fee),
    service_fee: numberOrZero(input.pricing?.service_fee ?? input.service_fee),
    total: numberOrZero(input.pricing?.total ?? input.total)
  };
}

export function withPricing<T extends PricingInput>(input: T): T & { pricing: PricingSummary } {
  return {
    ...input,
    pricing: buildPricingSummary(input)
  };
}
