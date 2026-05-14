import { describe, expect, it } from "vitest";
import { isActiveCustomerOrder, pickActiveCustomerOrder, sortOrdersByNewest } from "./orders";

function orderState(overrides: Partial<Parameters<typeof isActiveCustomerOrder>[0]> & { id?: number; created_at?: string }) {
  return {
    id: overrides.id ?? 1,
    created_at: overrides.created_at ?? "2026-05-13T12:00:00Z",
    status: overrides.status ?? "preparing",
    delivery_status: overrides.delivery_status ?? "assigned",
    delivered_at: overrides.delivered_at ?? null
  };
}

describe("customer order helpers", () => {
  it("treats delivered and cancelled order statuses as terminal", () => {
    expect(isActiveCustomerOrder(orderState({ status: "delivered" }))).toBe(false);
    expect(isActiveCustomerOrder(orderState({ status: "cancelled" }))).toBe(false);
    expect(isActiveCustomerOrder(orderState({ status: "delivery_failed" }))).toBe(false);
  });

  it("treats terminal delivery state as terminal even if order status is stale", () => {
    expect(isActiveCustomerOrder(orderState({ status: "out_for_delivery", delivery_status: "delivered" }))).toBe(false);
    expect(isActiveCustomerOrder(orderState({ status: "out_for_delivery", delivery_status: "delivery_failed" }))).toBe(false);
  });

  it("keeps newly received orders active until they reach a terminal state", () => {
    expect(isActiveCustomerOrder(orderState({ status: "created", delivery_status: "unassigned" }))).toBe(true);
  });

  it("picks the newest non-terminal order", () => {
    const active = orderState({ id: 10, created_at: "2026-05-13T12:00:00Z", status: "preparing" });
    const delivered = orderState({
      id: 11,
      created_at: "2026-05-13T12:05:00Z",
      status: "out_for_delivery",
      delivery_status: "delivered"
    });

    expect(pickActiveCustomerOrder([active, delivered])).toBe(active);
  });

  it("falls back to id when dates tie or are invalid", () => {
    expect(sortOrdersByNewest(orderState({ id: 1, created_at: "invalid" }), orderState({ id: 2, created_at: "invalid" }))).toBe(1);
  });
});
