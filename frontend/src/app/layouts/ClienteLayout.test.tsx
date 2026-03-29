import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Order } from "../../shared/types";
import { ClienteLayout } from "./ClienteLayout";

const fetchAddressesMock = vi.fn();
const fetchOrdersMock = vi.fn();
const logoutMock = vi.fn();

vi.mock("../../shared/hooks", () => ({
  useAuthSession: () => ({
    user: {
      id: 1,
      full_name: "Cliente Demo",
      email: "cliente@example.com",
      role: "customer",
      is_active: true
    },
    token: "token",
    isAuthenticated: true,
    logout: logoutMock
  }),
  useCart: () => ({
    itemCount: 0
  })
}));

vi.mock("../../shared/services/api", () => ({
  fetchAddresses: (...args: unknown[]) => fetchAddressesMock(...args),
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

function renderLayout(initialEntry = "/c") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/c" element={<ClienteLayout><div>catalogo page</div></ClienteLayout>} />
        <Route path="/c/pedidos" element={<ClienteLayout><div>pedidos page</div></ClienteLayout>} />
        <Route path="/c/pedido/:id" element={<ClienteLayout><div>tracking page</div></ClienteLayout>} />
        <Route path="/c/perfil" element={<ClienteLayout><div>perfil page</div></ClienteLayout>} />
        <Route path="/login" element={<div>login page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ClienteLayout", () => {
  beforeEach(() => {
    fetchAddressesMock.mockReset();
    fetchOrdersMock.mockReset();
    logoutMock.mockReset();
    fetchAddressesMock.mockResolvedValue([]);
    fetchOrdersMock.mockResolvedValue([]);
  });

  it("muestra Mis pedidos en el menu y navega a la ruta del historial", async () => {
    const user = userEvent.setup();

    renderLayout();

    await user.click(screen.getByRole("button", { name: /mi perfil/i }));
    expect(screen.getByRole("link", { name: "Mis pedidos" })).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Mis pedidos" }));

    expect(await screen.findByText("pedidos page")).toBeInTheDocument();
  });

  it("muestra la barra del pedido activo y evita el self-link en el tracking abierto", async () => {
    fetchOrdersMock.mockResolvedValueOnce([
      createOrder(),
      createOrder({
        id: 40,
        status: "created",
        created_at: "2026-03-29T11:30:00Z",
        eta_minutes: null
      })
    ]);

    renderLayout("/c/pedido/41");

    expect(await screen.findByText("Pedido en proceso")).toBeInTheDocument();
    expect(screen.getByText("Cafe Central")).toBeInTheDocument();
    expect(screen.getByText("Tracking abierto")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ver tracking" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /y 1 mas/i })).toHaveAttribute("href", "/c/pedidos");
  });

  it("no muestra la barra cuando solo hay pedidos terminales", async () => {
    fetchOrdersMock.mockResolvedValueOnce([
      createOrder({
        id: 50,
        status: "delivered",
        delivered_at: "2026-03-29T13:00:00Z"
      })
    ]);

    renderLayout();

    await waitFor(() => expect(fetchOrdersMock).toHaveBeenCalled());
    expect(screen.queryByText("Pedido en proceso")).not.toBeInTheDocument();
  });
});
