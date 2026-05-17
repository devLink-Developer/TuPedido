import { describe, expect, it } from "vitest";
import { getRiderDeliveryAddress } from "./deliveryOrderDisplay";

describe("delivery order display helpers", () => {
  it("keeps rider delivery addresses short when legacy snapshots include locality data", () => {
    expect(
      getRiderDeliveryAddress({
        delivery_mode: "delivery",
        address_full: "Corrientes 225, 223, Corrientes, Barrio Leandro N. Alem"
      })
    ).toBe("Corrientes 225, 223");
  });

  it("uses the pickup label for pickup orders", () => {
    expect(getRiderDeliveryAddress({ delivery_mode: "pickup", address_full: null })).toBe("Retiro en local");
  });
});
