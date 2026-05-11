import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MercadoPagoPage } from "./MercadoPagoPage";

const fetchMerchantStoreMock = vi.fn();
const fetchMerchantMercadoPagoConnectUrlMock = vi.fn();
const disconnectMerchantMercadoPagoMock = vi.fn();
const updateMerchantPaymentSettingsMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("../../../shared/hooks", () => ({
  useAuthSession: () => ({
    token: "token",
    refresh: refreshMock
  })
}));

vi.mock("../../../shared/services/api", () => ({
  disconnectMerchantMercadoPago: (...args: unknown[]) => disconnectMerchantMercadoPagoMock(...args),
  fetchMerchantMercadoPagoConnectUrl: (...args: unknown[]) => fetchMerchantMercadoPagoConnectUrlMock(...args),
  fetchMerchantStore: (...args: unknown[]) => fetchMerchantStoreMock(...args),
  updateMerchantPaymentSettings: (...args: unknown[]) => updateMerchantPaymentSettingsMock(...args)
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
  )
}));

vi.mock("../../../shared/ui/Button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>
}));

function buildStore(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    slug: "mi-local",
    name: "Mi Local",
    description: "Descripcion",
    address: "San Martin 123, Santa Fe",
    postal_code: "3000",
    province: "Santa Fe",
    locality: "Santa Fe",
    phone: "3420000000",
    latitude: -31.63,
    longitude: -60.7,
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
    category_ids: [1],
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
      mercadopago_provider_enabled: true,
      mercadopago_provider_mode: "sandbox",
      mercadopago_public_key_masked: null,
      mercadopago_connection_status: "disconnected",
      mercadopago_reconnect_required: false,
      mercadopago_onboarding_completed: false,
      mercadopago_oauth_connected_at: null,
      mercadopago_mp_user_id: null
    },
    product_categories: [],
    products: [],
    hours: [],
    ...overrides
  };
}

describe("MercadoPagoPage", () => {
  beforeEach(() => {
    fetchMerchantStoreMock.mockReset();
    fetchMerchantMercadoPagoConnectUrlMock.mockReset();
    disconnectMerchantMercadoPagoMock.mockReset();
    updateMerchantPaymentSettingsMock.mockReset();
    refreshMock.mockReset();
    vi.spyOn(window, "confirm").mockReturnValue(true);

    fetchMerchantStoreMock.mockResolvedValue(buildStore());
    fetchMerchantMercadoPagoConnectUrlMock.mockResolvedValue({
      connect_url: "http://localhost:8016/api/v1/oauth/mercadopago/connect",
      connection_status: "disconnected"
    });
    disconnectMerchantMercadoPagoMock.mockResolvedValue({ status: "disconnected" });
    updateMerchantPaymentSettingsMock.mockResolvedValue(buildStore());
  });

  it("muestra el resultado OAuth exitoso en la pantalla aislada", async () => {
    render(
      <MemoryRouter initialEntries={["/m/mercadopago?mercadopago_oauth=connected"]}>
        <MercadoPagoPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByRole("heading", { name: "Mercado Pago" })).toBeInTheDocument());
    expect(screen.getByText("La cuenta de Mercado Pago quedo conectada correctamente.")).toBeInTheDocument();
  });

  it("redirige al flujo OAuth cuando el comercio conecta Mercado Pago", async () => {
    const user = userEvent.setup();
    const assignMock = vi.fn();
    vi.stubGlobal("location", { assign: assignMock } as unknown as Location);

    render(
      <MemoryRouter>
        <MercadoPagoPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByRole("heading", { name: "Mercado Pago" })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Conectar con Mercado Pago" }));

    await waitFor(() => {
      expect(fetchMerchantMercadoPagoConnectUrlMock).toHaveBeenCalledWith("token");
      expect(assignMock).toHaveBeenCalledWith("http://localhost:8016/api/v1/oauth/mercadopago/connect");
    });

    vi.unstubAllGlobals();
  });

  it("permite desconectar una cuenta vinculada", async () => {
    const user = userEvent.setup();

    fetchMerchantStoreMock.mockResolvedValue(
      buildStore({
        payment_settings: {
          cash_enabled: true,
          mercadopago_enabled: true,
          mercadopago_configured: true,
          mercadopago_provider_enabled: true,
          mercadopago_provider_mode: "production",
          mercadopago_public_key_masked: "APP_USR-****",
          mercadopago_connection_status: "connected",
          mercadopago_reconnect_required: false,
          mercadopago_onboarding_completed: true,
          mercadopago_oauth_connected_at: "2026-03-31T10:00:00Z",
          mercadopago_mp_user_id: "123456789"
        }
      })
    );

    render(
      <MemoryRouter>
        <MercadoPagoPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("MP user id:")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Desconectar" }));

    await waitFor(() => expect(disconnectMerchantMercadoPagoMock).toHaveBeenCalledWith("token"));
  });
});
