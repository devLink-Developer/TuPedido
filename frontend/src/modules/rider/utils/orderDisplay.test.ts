import { describe, expect, it } from "vitest";
import { getRiderDeliveryAddress } from "./orderDisplay";

describe("rider order display helpers", () => {
  it("keeps delivery addresses to street and notes for rider screens", () => {
    expect(
      getRiderDeliveryAddress({
        delivery_mode: "delivery",
        address_full: "Corrientes 225, 223, Corrientes, Barrio Leandro N. Alem"
      })
    ).toBe("Corrientes 225, 223");
  });
});
