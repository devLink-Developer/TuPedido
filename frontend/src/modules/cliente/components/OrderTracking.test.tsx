import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Order, OrderTracking as OrderTrackingType } from "../../../shared/types";
import { OrderTracking } from "./OrderTracking";

vi.mock("../../../shared/components", () => ({
  LiveMap: () => <div data-testid="live-map" />
}));

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
    status: "preparing",
    address_label: "Casa",
    address_full: "San Martin 123",
    store_latitude: null,
    store_longitude: null,
    address_latitude: null,
    address_longitude: null,
    subtotal: 12000,
    commercial_discount_total: 0,
    financial_discount_total: 0,
    delivery_fee: 0,
    service_fee: 900,
    delivery_fee_customer: 0,
    rider_fee: 0,
    total: 12900,
    delivery_status: "assigned",
    delivery_provider: "platform",
    delivery_zone_id: null,
    assigned_rider_id: 9,
    assigned_rider_name: "Rider Demo",
    assigned_rider_phone_masked: "***1234",
    assigned_rider_vehicle_type: "motorcycle",
    tracking_last_latitude: null,
    tracking_last_longitude: null,
    tracking_last_at: null,
    tracking_stale: false,
    eta_minutes: 25,
    otp_required: true,
    merchant_ready_at: null,
    out_for_delivery_at: null,
    delivered_at: null,
    updated_at: "2026-03-29T12:10:00Z",
    created_at: "2026-03-29T12:00:00Z",
    items: [],
    pricing: {
      subtotal: 12000,
      commercialDiscountTotal: 0,
      financialDiscountTotal: 0,
      deliveryFee: 0,
      serviceFee: 900,
      total: 12900,
      complete: true
    },
    ...overrides
  };
}

function createTracking(overrides?: Partial<OrderTrackingType>): OrderTrackingType {
  return {
    order_id: 41,
    status: "preparing",
    delivery_status: "assigned",
    delivery_provider: "platform",
    tracking_enabled: true,
    assigned_rider_id: 9,
    assigned_rider_name: "Rider Demo",
    assigned_rider_phone_masked: "***1234",
    assigned_rider_vehicle_type: "motorcycle",
    store_latitude: -31.63,
    store_longitude: -60.7,
    address_latitude: -31.64,
    address_longitude: -60.71,
    tracking_last_latitude: -31.635,
    tracking_last_longitude: -60.705,
    tracking_last_at: "2026-03-29T12:15:00Z",
    tracking_stale: false,
    eta_minutes: 18,
    otp_required: true,
    otp_code: "123456",
    ...overrides
  };
}

describe("OrderTracking", () => {
  it("shows the delivery code as priority content before tracking metrics", () => {
    render(<OrderTracking order={createOrder()} tracking={createTracking()} />);

    const codeTitle = screen.getByText("Código de entrega");
    const statusMetric = screen.getByText("Estado");

    expect(screen.getByText("123456")).toBeInTheDocument();
    expect(codeTitle.compareDocumentPosition(statusMetric) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows a pending state when an OTP is required but the code has not arrived", () => {
    render(<OrderTracking order={createOrder()} tracking={createTracking({ otp_code: null })} />);

    expect(screen.getByText("Aparecerá cuando el seguimiento esté activo.")).toBeInTheDocument();
  });
});
