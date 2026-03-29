import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrdersPage } from "./OrdersPage";

const fetchMerchantOrdersMock = vi.fn();
const fetchMerchantRidersMock = vi.fn();
const fetchMerchantStoreMock = vi.fn();
const assignMerchantOrderRiderMock = vi.fn();
const updateMerchantOrderStatusMock = vi.fn();
const updateMerchantStoreMock = vi.fn();
const buildMerchantSocketUrlMock = vi.fn((_: string) => "ws://merchant.test");
const notifyCatalogStoresChangedMock = vi.fn();
const enqueueToastMock = vi.fn();
const playNotificationToneMock = vi.fn();

type MockSocketEvent = {
  data: string;
};

class MockWebSocket {
  static instances: MockWebSocket[] = [];

  onmessage: ((event: MockSocketEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(public readonly url: string) {
    MockWebSocket.instances.push(this);
  }

  emit(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }

  close() {
    return undefined;
  }

  static reset() {
    MockWebSocket.instances = [];
  }
}

vi.mock("../../../shared/hooks", () => ({
  useAuthSession: () => ({
    token: "token"
  })
}));

vi.mock("../../../shared/services/api", () => ({
  assignMerchantOrderRider: (token: string, orderId: number, riderUserId: number) =>
    assignMerchantOrderRiderMock(token, orderId, riderUserId),
  buildMerchantSocketUrl: (token: string) => buildMerchantSocketUrlMock(token),
  fetchMerchantOrders: (token: string) => fetchMerchantOrdersMock(token),
  fetchMerchantRiders: (token: string) => fetchMerchantRidersMock(token),
  fetchMerchantStore: (token: string) => fetchMerchantStoreMock(token),
  REALTIME_ENABLED: true,
  updateMerchantOrderStatus: (token: string, orderId: number, payload: unknown) =>
    updateMerchantOrderStatusMock(token, orderId, payload),
  updateMerchantStore: (token: string, payload: unknown) => updateMerchantStoreMock(token, payload)
}));

vi.mock("../../../shared/stores", () => ({
  useUiStore: (selector: (state: { enqueueToast: typeof enqueueToastMock }) => unknown) =>
    selector({ enqueueToast: enqueueToastMock })
}));

vi.mock("../../../shared/utils/catalogStores", () => ({
  notifyCatalogStoresChanged: () => notifyCatalogStoresChangedMock()
}));

vi.mock("../../../shared/utils/notificationSound", () => ({
  playNotificationTone: () => playNotificationToneMock()
}));

vi.mock("../components/OrdersTable", () => ({
  OrdersTable: ({ orders }: { orders: Array<{ id: number }> }) => (
    <div>{orders.map((order) => `Pedido #${order.id}`).join(", ")}</div>
  )
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
    free_delivery_min_order: null,
    rider_fee: 0,
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

const approvedStoreWithAddress = {
  ...approvedStore,
  latitude: -31.6333,
  longitude: -60.7000
};

const baseOrder = {
  id: 10,
  store_id: 1,
  store_name: "Mi Local",
  store_slug: "mi-local",
  customer_name: "Juan Perez",
  delivery_mode: "delivery" as const,
  payment_method: "cash" as const,
  payment_status: "pending",
  payment_reference: null,
  status: "created",
  address_label: "Casa",
  address_full: "San Martin 123",
  store_latitude: null,
  store_longitude: null,
  address_latitude: null,
  address_longitude: null,
  subtotal: 1000,
  commercial_discount_total: 0,
  financial_discount_total: 0,
  delivery_fee: 0,
  service_fee: 100,
  delivery_fee_customer: 0,
  rider_fee: 0,
  total: 1000,
  delivery_status: "unassigned",
  delivery_provider: "store",
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
  delivered_at: null,
  updated_at: null,
  created_at: "2026-03-29T12:00:00Z",
  items: [],
  pricing: {
    subtotal: 1000,
    deliveryFee: 0,
    serviceFee: 100,
    discountTotal: 0,
    total: 1000
  }
};

describe("OrdersPage", () => {
  beforeEach(() => {
    fetchMerchantOrdersMock.mockReset();
    fetchMerchantRidersMock.mockReset();
    fetchMerchantStoreMock.mockReset();
    assignMerchantOrderRiderMock.mockReset();
    updateMerchantOrderStatusMock.mockReset();
    updateMerchantStoreMock.mockReset();
    buildMerchantSocketUrlMock.mockClear();
    notifyCatalogStoresChangedMock.mockReset();
    enqueueToastMock.mockReset();
    playNotificationToneMock.mockReset();
    MockWebSocket.reset();
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
    fetchMerchantOrdersMock.mockResolvedValue([]);
    fetchMerchantRidersMock.mockResolvedValue([]);
  });

  it("permite habilitar y pausar la venta desde la pantalla de pedidos", async () => {
    const user = userEvent.setup();

    fetchMerchantStoreMock.mockResolvedValueOnce(approvedStoreWithAddress);
    updateMerchantStoreMock.mockResolvedValueOnce({ ...approvedStoreWithAddress, accepting_orders: false });

    render(<OrdersPage />);

    await waitFor(() => expect(fetchMerchantStoreMock).toHaveBeenCalledWith("token"));
    expect(screen.getByRole("switch", { name: "Recibir pedidos" })).toHaveAttribute("aria-checked", "true");

    await user.click(screen.getByRole("switch", { name: "Recibir pedidos" }));

    await waitFor(() =>
      expect(updateMerchantStoreMock).toHaveBeenCalledWith(
        "token",
        expect.objectContaining({
          accepting_orders: false,
          name: approvedStoreWithAddress.name,
          address: approvedStoreWithAddress.address
        })
      )
    );
    await waitFor(() =>
      expect(screen.getByRole("switch", { name: "Recibir pedidos" })).toHaveAttribute("aria-checked", "false")
    );
    expect(screen.getByText("Venta pausada")).toBeInTheDocument();
    expect(notifyCatalogStoresChangedMock).toHaveBeenCalledTimes(1);
  });

  it("bloquea el toggle hasta que el comercio quede aprobado", async () => {
    fetchMerchantStoreMock.mockResolvedValueOnce({ ...approvedStore, status: "pending_review", accepting_orders: false });

    render(<OrdersPage />);

    await waitFor(() => expect(fetchMerchantStoreMock).toHaveBeenCalledWith("token"));
    expect(screen.getByRole("switch", { name: "Recibir pedidos" })).toBeDisabled();
    expect(screen.getByText("Disponible cuando el comercio quede aprobado.")).toBeInTheDocument();
  });

  it("no permite habilitar la venta si falta configurar la direccion del comercio", async () => {
    fetchMerchantStoreMock.mockResolvedValueOnce({ ...approvedStore, accepting_orders: false });

    render(<OrdersPage />);

    await waitFor(() => expect(fetchMerchantStoreMock).toHaveBeenCalledWith("token"));
    expect(screen.getByRole("switch", { name: "Recibir pedidos" })).toBeDisabled();
    expect(screen.getByText("Configura la direccion del comercio antes de habilitar la venta.")).toBeInTheDocument();
    expect(screen.getByText("Completa la direccion")).toBeInTheDocument();
    expect(updateMerchantStoreMock).not.toHaveBeenCalled();
  });

  it("agrega pedidos nuevos en vivo con toast y sonido sin mostrar loading otra vez", async () => {
    fetchMerchantStoreMock.mockResolvedValueOnce(approvedStoreWithAddress);
    fetchMerchantOrdersMock.mockResolvedValueOnce([baseOrder]);

    render(<OrdersPage />);

    await waitFor(() => expect(screen.getByText("Pedido #10")).toBeInTheDocument());
    expect(buildMerchantSocketUrlMock).toHaveBeenCalledWith("token");
    expect(MockWebSocket.instances).toHaveLength(1);

    MockWebSocket.instances[0].emit({
      type: "order.created",
      order: { ...baseOrder, id: 99, customer_name: "Ana Gomez" }
    });

    await waitFor(() => expect(screen.getByText(/Pedido #99/)).toBeInTheDocument());
    expect(enqueueToastMock).toHaveBeenCalledWith("Nuevo pedido #99 de Ana Gomez");
    expect(playNotificationToneMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Cargando...")).not.toBeInTheDocument();
  });
});
