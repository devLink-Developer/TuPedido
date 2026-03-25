import { describe, expect, it } from "vitest";
import { roleToHomePath } from "./routing";

describe("roleToHomePath", () => {
  it("maps backend roles to the new homes", () => {
    expect(roleToHomePath.customer).toBe("/c");
    expect(roleToHomePath.merchant).toBe("/m");
    expect(roleToHomePath.delivery).toBe("/r");
    expect(roleToHomePath.admin).toBe("/a");
  });
});
