import { describe, expect, it } from "vitest";
import { canUseCustomerApp, canUseDeliveryApp, homeForRole } from "./roleRouting";

describe("role routing", () => {
  it("routes customers to the customer app", () => {
    expect(homeForRole("customer")).toBe("CustomerTabs");
    expect(canUseCustomerApp("customer")).toBe(true);
    expect(canUseDeliveryApp("customer")).toBe(false);
  });

  it("routes delivery users to the delivery app", () => {
    expect(homeForRole("delivery")).toBe("DeliveryTabs");
    expect(canUseDeliveryApp("delivery")).toBe(true);
    expect(canUseCustomerApp("delivery")).toBe(false);
  });

  it("keeps merchant and admin out of mobile v1", () => {
    expect(homeForRole("merchant")).toBe("UnsupportedRole");
    expect(homeForRole("admin")).toBe("UnsupportedRole");
  });
});
