import { describe, expect, it, vi } from "vitest";
import type { Cart, Order } from "../../shared/types";
import { repeatOrderIntoCart } from "./repeatOrder";

function createOrder(overrides?: Partial<Order>): Order {
  return {
    id: 41,
    store_id: 15,
    store_name: "Cafe Central",
    store_slug: "cafe-central",
    customer_name: "Cliente Demo",
    delivery_mode: "delivery",
    payment_method: "cash",
    payment_status: "pending",
    payment_reference: null,
    status: "delivered",
    address_label: "Casa",
    address_full: "San Martin 123",
    store_latitude: -31.63,
    store_longitude: -60.7,
    address_latitude: -31.64,
    address_longitude: -60.71,
    subtotal: 1000,
    commercial_discount_total: 0,
    financial_discount_total: 0,
    delivery_fee: 0,
    service_fee: 0,
    delivery_fee_customer: 0,
    rider_fee: 0,
    total: 1000,
    delivery_status: "delivered",
    delivery_provider: "platform",
    delivery_zone_id: null,
    assigned_rider_id: null,
    assigned_rider_name: null,
    assigned_rider_phone_masked: null,
    assigned_rider_vehicle_type: null,
    tracking_last_latitude: null,
    tracking_last_longitude: null,
    tracking_last_at: null,
    tracking_stale: false,
    eta_minutes: null,
    otp_required: false,
    merchant_ready_at: null,
    out_for_delivery_at: null,
    delivered_at: "2026-03-29T12:25:00Z",
    updated_at: "2026-03-29T12:25:00Z",
    created_at: "2026-03-29T12:00:00Z",
    items: [
      {
        id: 1,
        product_id: 7,
        product_name: "Cafe",
        base_unit_price: 1000,
        quantity: 2,
        unit_price: 1000,
        commercial_discount_amount: 0,
        note: "Sin azucar"
      }
    ],
    pricing: {
      subtotal: 1000,
      commercialDiscountTotal: 0,
      financialDiscountTotal: 0,
      deliveryFee: 0,
      serviceFee: 0,
      total: 1000,
      complete: true
    },
    ...overrides
  };
}

function createCart(unitPrice: number): Cart {
  return {
    id: 1,
    store_id: 15,
    store_name: "Cafe Central",
    store_slug: "cafe-central",
    delivery_mode: "delivery",
    delivery_settings: {} as Cart["delivery_settings"],
    subtotal: unitPrice * 2,
    commercial_discount_total: 0,
    financial_discount_total: 0,
    delivery_fee: 0,
    service_fee: 0,
    total: unitPrice * 2,
    items: [
      {
        id: 9,
        product_id: 7,
        product_name: "Cafe",
        base_unit_price: unitPrice,
        unit_price: unitPrice,
        commercial_discount_amount: 0,
        quantity: 2,
        note: "Sin azucar"
      }
    ],
    pricing: {
      subtotal: unitPrice * 2,
      commercialDiscountTotal: 0,
      financialDiscountTotal: 0,
      deliveryFee: 0,
      serviceFee: 0,
      total: unitPrice * 2,
      complete: true
    }
  };
}

describe("repeatOrderIntoCart", () => {
  it("agrega productos por id y detecta precios vigentes modificados", async () => {
    const addItem = vi.fn().mockResolvedValue(createCart(1200));
    const setDeliveryMode = vi.fn().mockResolvedValue(undefined);

    const result = await repeatOrderIntoCart(createOrder(), { addItem, setDeliveryMode });

    expect(addItem).toHaveBeenCalledWith({
      storeId: 15,
      productId: 7,
      quantity: 2,
      note: "Sin azucar",
      customerLatitude: -31.64,
      customerLongitude: -60.71
    });
    expect(setDeliveryMode).toHaveBeenCalledWith("delivery", { latitude: -31.64, longitude: -60.71 });
    expect(result.addedItemCount).toBe(2);
    expect(result.priceChangedItemNames).toEqual(["Cafe"]);
    expect(result.failedItemNames).toEqual([]);
  });
});
