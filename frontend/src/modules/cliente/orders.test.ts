import { describe, expect, it } from "vitest";
import { isActiveCustomerOrder, sortOrdersByNewest } from "./orders";

function orderState(overrides?: Partial<Parameters<typeof isActiveCustomerOrder>[0]> & { id?: number; created_at?: string }) {
  return {
    id: overrides?.id ?? 1,
    created_at: overrides?.created_at ?? "2026-05-13T12:00:00Z",
    status: overrides?.status ?? "preparing",
    delivery_status: overrides?.delivery_status ?? "assigned",
    delivered_at: overrides?.delivered_at ?? null
  };
}

describe("customer order helpers", () => {
  it("solo mantiene activos pedidos no terminales", () => {
    expect(isActiveCustomerOrder(orderState({ status: "created", delivery_status: "assignment_pending" }))).toBe(true);
    expect(isActiveCustomerOrder(orderState({ status: "preparing", delivery_status: "assigned" }))).toBe(true);
    expect(isActiveCustomerOrder(orderState({ status: "ready_for_dispatch", delivery_status: "picked_up" }))).toBe(true);
    expect(isActiveCustomerOrder(orderState({ status: "out_for_delivery", delivery_status: "near_customer" }))).toBe(true);
  });

  it("oculta entregados o cancelados aunque algun campo quede desincronizado", () => {
    expect(isActiveCustomerOrder(orderState({ status: "delivered" }))).toBe(false);
    expect(isActiveCustomerOrder(orderState({ status: "cancelled" }))).toBe(false);
    expect(isActiveCustomerOrder(orderState({ status: "delivery_failed" }))).toBe(false);
    expect(isActiveCustomerOrder(orderState({ status: "out_for_delivery", delivery_status: "delivered" }))).toBe(false);
    expect(isActiveCustomerOrder(orderState({ status: "preparing", delivery_status: "delivery_failed" }))).toBe(false);
    expect(isActiveCustomerOrder(orderState({ status: "preparing", delivered_at: "2026-05-13T12:05:00Z" }))).toBe(false);
  });

  it("ordena por fecha descendente y usa id como desempate", () => {
    expect(sortOrdersByNewest(orderState({ id: 1, created_at: "invalid" }), orderState({ id: 2, created_at: "invalid" }))).toBe(1);
  });
});
