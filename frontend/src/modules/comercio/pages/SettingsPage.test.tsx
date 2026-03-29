import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "./SettingsPage";

const fetchMerchantStoreMock = vi.fn();
const fetchMerchantProductCategoriesMock = vi.fn();
const updateMerchantStoreMock = vi.fn();
const updateMerchantStoreCategoriesMock = vi.fn();
const updateMerchantDeliverySettingsMock = vi.fn();
const updateMerchantPaymentSettingsMock = vi.fn();
const loadCategoriesMock = vi.fn();

vi.mock("../../../shared/hooks", () => ({
  useAuthSession: () => ({
    token: "token"
  })
}));

vi.mock("../../../shared/stores", () => ({
  useCategoryStore: (selector: (state: { categories: unknown[]; loading: boolean; loadCategories: typeof loadCategoriesMock }) => unknown) =>
    selector({
      categories: [],
      loading: false,
      loadCategories: loadCategoriesMock
    })
}));

vi.mock("../../../shared/services/api", () => ({
  createMerchantProductCategory: vi.fn(),
  createMerchantProductSubcategory: vi.fn(),
  deleteMerchantProductCategory: vi.fn(),
  deleteMerchantProductSubcategory: vi.fn(),
  fetchMerchantProductCategories: (...args: unknown[]) => fetchMerchantProductCategoriesMock(...args),
  fetchMerchantStore: (...args: unknown[]) => fetchMerchantStoreMock(...args),
  geocodeAddress: vi.fn(),
  updateMerchantProductCategory: vi.fn(),
  updateMerchantProductSubcategory: vi.fn(),
  updateMerchantDeliverySettings: (...args: unknown[]) => updateMerchantDeliverySettingsMock(...args),
  updateMerchantPaymentSettings: (...args: unknown[]) => updateMerchantPaymentSettingsMock(...args),
  updateMerchantStore: (...args: unknown[]) => updateMerchantStoreMock(...args),
  updateMerchantStoreCategories: (...args: unknown[]) => updateMerchantStoreCategoriesMock(...args)
}));

vi.mock("../../../shared/components", () => ({
  EmptyState: ({ title, description }: { title: string; description?: string }) => (
    <div>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </div>
  ),
  ImageAssetField: ({ label }: { label: string }) => <div>{label}</div>,
  LoadingCard: () => <div>Cargando...</div>,
  PageHeader: ({ title, description }: { title: string; description?: string }) => (
    <div>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </div>
  ),
  RubroChip: ({ label }: { label: string }) => <button type="button">{label}</button>,
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
      mercadopago_public_key_masked: null,
      mercadopago_connection_status: null,
      mercadopago_reconnect_required: false
    },
    product_categories: [],
    products: [],
    hours: [],
    ...overrides
  };
}

describe("SettingsPage", () => {
  beforeEach(() => {
    fetchMerchantStoreMock.mockReset();
    fetchMerchantProductCategoriesMock.mockReset();
    updateMerchantStoreMock.mockReset();
    updateMerchantStoreCategoriesMock.mockReset();
    updateMerchantDeliverySettingsMock.mockReset();
    updateMerchantPaymentSettingsMock.mockReset();
    loadCategoriesMock.mockReset();

    loadCategoriesMock.mockResolvedValue(undefined);
    fetchMerchantProductCategoriesMock.mockResolvedValue([]);
    updateMerchantStoreMock.mockResolvedValue(undefined);
    updateMerchantStoreCategoriesMock.mockResolvedValue(undefined);
    updateMerchantDeliverySettingsMock.mockResolvedValue(undefined);
    updateMerchantPaymentSettingsMock.mockResolvedValue(undefined);
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
        delivery_settings: {
          delivery_enabled: false,
          pickup_enabled: true,
          delivery_fee: 0,
          free_delivery_min_order: null,
          rider_fee: 0,
          min_order: 0
        }
      })
    );

    render(<SettingsPage />);

    await waitFor(() => expect(screen.getByText("Configura tu local")).toBeInTheDocument());
    expect(screen.queryByText("Formulario direccion")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agregar direccion" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Agregar direccion" }));

    expect(screen.getByText("Formulario direccion")).toBeInTheDocument();
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
          delivery_settings: {
            delivery_enabled: false,
            pickup_enabled: true,
            delivery_fee: 0,
            free_delivery_min_order: null,
            rider_fee: 0,
            min_order: 0
          }
        })
      );

    render(<SettingsPage />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Eliminar direccion" })).toBeInTheDocument());
    expect(screen.queryByText("Formulario direccion")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Eliminar direccion" }));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() =>
      expect(updateMerchantStoreMock).toHaveBeenCalledWith(
        "token",
        expect.objectContaining({
          address: "",
          postal_code: null,
          province: null,
          locality: null,
          latitude: null,
          longitude: null
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
