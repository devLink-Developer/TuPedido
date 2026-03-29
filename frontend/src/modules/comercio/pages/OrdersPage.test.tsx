import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrdersPage } from "./OrdersPage";

const fetchMerchantOrdersMock = vi.fn();
const fetchMerchantStoreMock = vi.fn();
const updateMerchantOrderStatusMock = vi.fn();
const updateMerchantStoreMock = vi.fn();

vi.mock("../../../shared/hooks", () => ({
  useAuthSession: () => ({
    token: "token"
  })
}));

vi.mock("../../../shared/services/api", () => ({
  fetchMerchantOrders: (...args: unknown[]) => fetchMerchantOrdersMock(...args),
  fetchMerchantStore: (...args: unknown[]) => fetchMerchantStoreMock(...args),
  updateMerchantOrderStatus: (...args: unknown[]) => updateMerchantOrderStatusMock(...args),
  updateMerchantStore: (...args: unknown[]) => updateMerchantStoreMock(...args)
}));

vi.mock("../components/OrdersTable", () => ({
  OrdersTable: () => <div>Tabla de pedidos</div>
}));

const approvedStore = {
  id: 1,
  slug: "mi-local",
  name: "Mi Local",
  description: "Descripcion",
  address: "San Martin 123",
  postal_code: "3000",
  province: "Santa Fe",
  locality: "Santa Fe",
  phone: "3420000000",
  latitude: null,
  longitude: null,
  logo_url: null,
  cover_image_url: null,
  status: "approved",
  accepting_orders: true,
  is_open: true,
  opening_note: null,
  min_delivery_minutes: 20,
  max_delivery_minutes: 45,
  rating: 0,
  rating_count: 0,
  category_ids: [],
  primary_category_id: null,
  primary_category: null,
  primary_category_slug: null,
  categories: [],
  delivery_settings: {
    delivery_enabled: true,
    pickup_enabled: true,
    delivery_fee: 0,
    min_order: 0
  },
  payment_settings: {
    cash_enabled: true,
    mercadopago_enabled: false,
    mercadopago_configured: false,
    mercadopago_public_key_masked: null,
    mercadopago_connection_status: null,
    mercadopago_reconnect_required: false
  },
  product_categories: [],
  products: [],
  hours: []
};

describe("OrdersPage", () => {
  beforeEach(() => {
    fetchMerchantOrdersMock.mockReset();
    fetchMerchantStoreMock.mockReset();
    updateMerchantOrderStatusMock.mockReset();
    updateMerchantStoreMock.mockReset();
    fetchMerchantOrdersMock.mockResolvedValue([]);
  });

  it("permite habilitar y pausar la venta desde la pantalla de pedidos", async () => {
    const user = userEvent.setup();

    fetchMerchantStoreMock.mockResolvedValueOnce(approvedStore);
    updateMerchantStoreMock.mockResolvedValueOnce({ ...approvedStore, accepting_orders: false });

    render(<OrdersPage />);

    await waitFor(() => expect(fetchMerchantStoreMock).toHaveBeenCalledWith("token"));
    expect(screen.getByRole("switch", { name: "Recibir pedidos" })).toHaveAttribute("aria-checked", "true");

    await user.click(screen.getByRole("switch", { name: "Recibir pedidos" }));

    await waitFor(() =>
      expect(updateMerchantStoreMock).toHaveBeenCalledWith(
        "token",
        expect.objectContaining({
          accepting_orders: false,
          name: approvedStore.name,
          address: approvedStore.address
        })
      )
    );
    await waitFor(() =>
      expect(screen.getByRole("switch", { name: "Recibir pedidos" })).toHaveAttribute("aria-checked", "false")
    );
    expect(screen.getByText("Venta pausada")).toBeInTheDocument();
  });

  it("bloquea el toggle hasta que el comercio quede aprobado", async () => {
    fetchMerchantStoreMock.mockResolvedValueOnce({ ...approvedStore, status: "pending_review", accepting_orders: false });

    render(<OrdersPage />);

    await waitFor(() => expect(fetchMerchantStoreMock).toHaveBeenCalledWith("token"));
    expect(screen.getByRole("switch", { name: "Recibir pedidos" })).toBeDisabled();
    expect(screen.getByText("Disponible cuando el comercio quede aprobado.")).toBeInTheDocument();
  });
});
