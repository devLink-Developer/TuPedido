import { describe, expect, it } from "vitest";
import { buildPricingSummary } from "./pricing";

describe("buildPricingSummary", () => {
  it("uses explicit pricing when present", () => {
    expect(
      buildPricingSummary({
        subtotal: 100,
        commercial_discount_total: 0,
        financial_discount_total: 0,
        delivery_fee: 10,
        service_fee: 5,
        total: 115,
        pricing: { total: 99 }
      }).total
    ).toBe(99);
  });

  it("falls back to top-level totals", () => {
    expect(
      buildPricingSummary({
        subtotal: 100,
        commercial_discount_total: 10,
        financial_discount_total: 5,
        delivery_fee: 20,
        service_fee: 7,
        total: 112
      })
    ).toEqual({
      subtotal: 100,
      commercial_discount_total: 10,
      financial_discount_total: 5,
      delivery_fee: 20,
      service_fee: 7,
      total: 112
    });
  });
});
