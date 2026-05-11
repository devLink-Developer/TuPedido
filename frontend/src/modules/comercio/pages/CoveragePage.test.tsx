import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CoveragePage } from "./CoveragePage";

const fetchMerchantStoreMock = vi.fn();
const updateMerchantStoreMock = vi.fn();
const updateMerchantDeliverySettingsMock = vi.fn();
const geocodeAddressMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("../../../shared/hooks", () => ({
  useAuthSession: () => ({
    token: "token",
    refresh: refreshMock
  })
}));

vi.mock("../../../shared/services/api", () => ({
  fetchMerchantStore: (...args: unknown[]) => fetchMerchantStoreMock(...args),
  geocodeAddress: (...args: unknown[]) => geocodeAddressMock(...args),
  updateMerchantDeliverySettings: (...args: unknown[]) => updateMerchantDeliverySettingsMock(...args),
  updateMerchantStore: (...args: unknown[]) => updateMerchantStoreMock(...args)
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

vi.mock("../../../shared/ui/Button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>
}));

vi.mock("../components/StoreAddressSection", () => ({
  StoreAddressSection: () => <div>Formulario direccion</div>,
  emptyStoreAddressForm: {
    postal_code: "",
    province: "",
    locality: "",
    street_name: "",
    street_number: "",
    latitude: "",
    longitude: ""
  },
  hasStoreAddressConfiguration: (form: {
    postal_code: string;
    province: string;
    locality: string;
    street_name: string;
    street_number: string;
    latitude: string;
    longitude: string;
  }) =>
    Boolean(
      form.postal_code.trim() &&
        form.province.trim() &&
        form.locality.trim() &&
        form.street_name.trim() &&
        form.street_number.trim() &&
        form.latitude.trim() &&
        form.longitude.trim()
    ),
  toStoreAddressFormState: (store?: {
    postal_code?: string | null;
    province?: string | null;
    locality?: string | null;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  }) => {
    const [streetName = "", streetNumber = ""] = (store?.address ?? "").split(",")[0]?.trim().split(" ") ?? [];
    return {
      postal_code: store?.postal_code ?? "",
      province: store?.province ?? "",
      locality: store?.locality ?? "",
      street_name: streetName,
      street_number: streetNumber,
      latitude: store?.latitude == null ? "" : String(store.latitude),
      longitude: store?.longitude == null ? "" : String(store.longitude)
    };
  },
  toStoreAddressPayload: (form: {
    postal_code: string;
    province: string;
    locality: string;
    street_name: string;
    street_number: string;
    latitude: string;
    longitude: string;
  }) =>
    form.postal_code.trim() &&
    form.province.trim() &&
    form.locality.trim() &&
    form.street_name.trim() &&
    form.street_number.trim() &&
    form.latitude.trim() &&
    form.longitude.trim()
      ? {
          address: `${form.street_name.trim()} ${form.street_number.trim()}, ${form.locality.trim()}, ${form.province.trim()}, ${form.postal_code.trim()}`,
          postal_code: form.postal_code.trim(),
          province: form.province.trim(),
          locality: form.locality.trim(),
          latitude: Number(form.latitude),
          longitude: Number(form.longitude)
        }
      : null
}));

vi.mock("../components/StoreCoverageSection", () => ({
  StoreCoverageSection: () => <div>Formulario zonas</div>,
  hasAnyCoverageArea: (settings: { delivery_area_polygon?: unknown[]; pickup_area_polygon?: unknown[] }) =>
    Boolean(settings.delivery_area_polygon?.length || settings.pickup_area_polygon?.length)
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
      min_order: 0,
      delivery_area_polygon: [
        { latitude: -31.64, longitude: -60.71 },
        { latitude: -31.64, longitude: -60.69 },
        { latitude: -31.62, longitude: -60.69 }
      ],
      pickup_area_polygon: [
        { latitude: -31.64, longitude: -60.71 },
        { latitude: -31.64, longitude: -60.69 },
        { latitude: -31.62, longitude: -60.69 }
      ],
      pickup_area_uses_delivery_area: true
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

describe("CoveragePage", () => {
  beforeEach(() => {
    fetchMerchantStoreMock.mockReset();
    updateMerchantStoreMock.mockReset();
    updateMerchantDeliverySettingsMock.mockReset();
    geocodeAddressMock.mockReset();
    refreshMock.mockReset();
    updateMerchantStoreMock.mockResolvedValue(undefined);
    updateMerchantDeliverySettingsMock.mockResolvedValue(undefined);
    geocodeAddressMock.mockResolvedValue({ latitude: -31.63, longitude: -60.7 });
  });

  it("mantiene oculto el formulario de direccion hasta que el usuario decide agregarla", async () => {
    const user = userEvent.setup();

    fetchMerchantStoreMock.mockResolvedValue(
      buildStore({
        address: "",
        postal_code: null,
        province: null,
        locality: null,
        latitude: null,
        longitude: null,
        accepting_orders: false,
        delivery_settings: {
          delivery_enabled: false,
          pickup_enabled: true,
          delivery_fee: 0,
          free_delivery_min_order: null,
          rider_fee: 0,
          min_order: 0,
          delivery_area_polygon: [],
          pickup_area_polygon: [],
          pickup_area_uses_delivery_area: false
        }
      })
    );

    render(
      <MemoryRouter>
        <CoveragePage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Direccion y alcance")).toBeInTheDocument());
    expect(screen.queryByText("Formulario direccion")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agregar direccion" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Agregar direccion" }));

    expect(screen.getByText("Formulario direccion")).toBeInTheDocument();
    expect(screen.getByText("Formulario zonas")).toBeInTheDocument();
  });

  it("permite eliminar la direccion y guardarla vacia", async () => {
    const user = userEvent.setup();

    fetchMerchantStoreMock
      .mockResolvedValueOnce(buildStore())
      .mockResolvedValueOnce(
        buildStore({
          address: "",
          postal_code: null,
          province: null,
          locality: null,
          latitude: null,
          longitude: null,
          accepting_orders: false,
          delivery_settings: {
            delivery_enabled: false,
            pickup_enabled: true,
            delivery_fee: 0,
            free_delivery_min_order: null,
            rider_fee: 0,
            min_order: 0,
            delivery_area_polygon: [],
            pickup_area_polygon: [],
            pickup_area_uses_delivery_area: false
          }
        })
      );

    render(
      <MemoryRouter>
        <CoveragePage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByRole("button", { name: "Eliminar direccion" })).toBeInTheDocument());
    expect(screen.queryByText("Formulario direccion")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Eliminar direccion" }));
    await user.click(screen.getByRole("button", { name: "Guardar direccion y alcance" }));

    await waitFor(() =>
      expect(updateMerchantStoreMock).toHaveBeenCalledWith(
        "token",
        expect.objectContaining({
          address: "",
          postal_code: null,
          province: null,
          locality: null,
          latitude: null,
          longitude: null,
          accepting_orders: false
        })
      )
    );
    expect(updateMerchantDeliverySettingsMock).toHaveBeenCalledWith(
      "token",
      expect.objectContaining({
        delivery_enabled: false
      })
    );
  });
});
