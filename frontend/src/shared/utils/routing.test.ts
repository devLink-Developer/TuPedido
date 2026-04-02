import { describe, expect, it } from "vitest";
import { normalizePath, roleToHomePath } from "./routing";

describe("roleToHomePath", () => {
  it("maps backend roles to the new homes", () => {
    expect(roleToHomePath.customer).toBe("/c");
    expect(roleToHomePath.merchant).toBe("/m");
    expect(roleToHomePath.delivery).toBe("/r");
    expect(roleToHomePath.admin).toBe("/a");
  });
});

describe("normalizePath", () => {
  it("keeps same-origin absolute urls as app paths", () => {
    expect(normalizePath(`${window.location.origin}/c/checkout?step=2#summary`)).toBe("/c/checkout?step=2#summary");
  });

  it("preserves external absolute urls", () => {
    expect(normalizePath("https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=123")).toBe(
      "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=123"
    );
  });
});
