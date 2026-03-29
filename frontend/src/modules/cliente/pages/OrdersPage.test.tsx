import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Order } from "../../../shared/types";
import { OrdersPage } from "./OrdersPage";

const fetchOrdersMock = vi.fn();

vi.mock("../../../shared/hooks", () => ({
  useAuthSession: () => ({
    token: "token"
  })
}));

vi.mock("../../../shared/services/api", () => ({
  fetchOrders: (...args: unknown[]) => fetchOrdersMock(...args)
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
    delivery_status: "assignment_pending",
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
    eta_minutes: 25,
    otp_required: false,
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

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

describe("OrdersPage", () => {
  beforeEach(() => {
    fetchOrdersMock.mockReset();
  });

  it("muestra loading y luego el historial con links al detalle", async () => {
    const request = createDeferred<Order[]>();
    fetchOrdersMock.mockReturnValueOnce(request.promise);

    render(
      <MemoryRouter>
        <OrdersPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Cargando...")).toBeInTheDocument();

    request.resolve([createOrder()]);

    expect(await screen.findByText("Cafe Central")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Cafe Central/i })).toHaveAttribute("href", "/c/pedido/41");
  });

  it("muestra estado vacio cuando no hay pedidos", async () => {
    fetchOrdersMock.mockResolvedValueOnce([]);

    render(
      <MemoryRouter>
        <OrdersPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Todavia no tienes pedidos")).toBeInTheDocument();
  });

  it("muestra el error del endpoint cuando falla la carga", async () => {
    fetchOrdersMock.mockRejectedValueOnce(new Error("Fallo de red"));

    render(
      <MemoryRouter>
        <OrdersPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("No se pudieron cargar tus pedidos")).toBeInTheDocument());
    expect(screen.getByText("Fallo de red")).toBeInTheDocument();
  });
});
