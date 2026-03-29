import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Order, OrderTracking } from "../../../shared/types";
import { OrderPage } from "./OrderPage";

const fetchOrderMock = vi.fn();
const fetchOrderTrackingMock = vi.fn();
const useOrderLiveTrackingMock = vi.fn();

vi.mock("../../../shared/hooks", () => ({
  useAuthSession: () => ({
    token: "token"
  }),
  useOrderLiveTracking: (options: unknown) => useOrderLiveTrackingMock(options)
}));

vi.mock("../../../shared/services/api", () => ({
  fetchOrder: (...args: unknown[]) => fetchOrderMock(...args),
  fetchOrderTracking: (...args: unknown[]) => fetchOrderTrackingMock(...args)
}));

vi.mock("../../../shared/components", () => ({
  EmptyState: ({ title, description }: { title: string; description?: string }) => (
    <div>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </div>
  ),
  LoadingCard: () => <div>Cargando...</div>,
  PageHeader: ({ title, description }: { title: string; description?: string }) => (
    <div>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </div>
  ),
  StatusPill: ({ value }: { value: string }) => <span>{value}</span>
}));

vi.mock("../components/CheckoutSummary", () => ({
  CheckoutSummary: ({ title }: { title: string }) => <div>{title}</div>
}));

vi.mock("../components/OrderTracking", () => ({
  OrderTracking: () => <div>tracking-block</div>
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

function createTracking(overrides?: Partial<OrderTracking>): OrderTracking {
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
    otp_required: false,
    otp_code: null,
    ...overrides
  };
}

function renderPage(initialEntry = "/c/pedido/41") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/c/pedido/:id" element={<OrderPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("OrderPage", () => {
  beforeEach(() => {
    fetchOrderMock.mockReset();
    fetchOrderTrackingMock.mockReset();
    useOrderLiveTrackingMock.mockReset();
  });

  it("muestra tracking para pedidos activos", async () => {
    fetchOrderMock.mockResolvedValueOnce(createOrder());
    fetchOrderTrackingMock.mockResolvedValueOnce(createTracking());

    renderPage();

    expect(await screen.findByText("Estado del pedido")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Preparando" })).toBeInTheDocument();
    expect(screen.getByText("El comercio esta preparando tu pedido.")).toBeInTheDocument();
    expect(screen.getByText("Seguimos mostrando la ubicacion del pedido en tiempo real.")).toBeInTheDocument();
    expect(screen.getByText("Entrega y pago")).toBeInTheDocument();
    expect(await screen.findByText("tracking-block")).toBeInTheDocument();
    expect(fetchOrderTrackingMock).toHaveBeenCalledWith("token", 41);
    expect(useOrderLiveTrackingMock.mock.calls.some(([options]) => (options as { enabled: boolean }).enabled)).toBe(true);
  });

  it("no consulta tracking ni renderiza seguimiento para pedidos terminales", async () => {
    fetchOrderMock.mockResolvedValue(createOrder({ status: "delivered", delivered_at: "2026-03-29T12:25:00Z" }));

    renderPage();

    expect(await screen.findByRole("heading", { name: "Pedido #41" })).toBeInTheDocument();
    expect(screen.getByText("El pedido ya fue entregado y quedo en tu historial.")).toBeInTheDocument();
    expect(screen.getByText("El seguimiento en vivo ya no esta disponible para este pedido.")).toBeInTheDocument();
    expect(fetchOrderTrackingMock).not.toHaveBeenCalled();
    expect(screen.queryByText("tracking-block")).not.toBeInTheDocument();
    expect(useOrderLiveTrackingMock.mock.calls.every(([options]) => !(options as { enabled: boolean }).enabled)).toBe(true);

    window.dispatchEvent(new Event("focus"));

    await waitFor(() => expect(fetchOrderMock).toHaveBeenCalledTimes(2));
    expect(fetchOrderTrackingMock).not.toHaveBeenCalled();
  });

  it("oculta el tracking cuando el pedido pasa a entregado en una actualizacion", async () => {
    fetchOrderMock
      .mockResolvedValueOnce(createOrder())
      .mockResolvedValueOnce(createOrder({ status: "delivered", delivered_at: "2026-03-29T12:25:00Z" }));
    fetchOrderTrackingMock.mockResolvedValueOnce(createTracking());

    renderPage();

    expect(await screen.findByText("tracking-block")).toBeInTheDocument();

    window.dispatchEvent(new Event("focus"));

    await waitFor(() => expect(fetchOrderMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText("tracking-block")).not.toBeInTheDocument());
    expect(screen.getByText("El pedido ya fue entregado y quedo en tu historial.")).toBeInTheDocument();
    expect(fetchOrderTrackingMock).toHaveBeenCalledTimes(1);
  });
});
