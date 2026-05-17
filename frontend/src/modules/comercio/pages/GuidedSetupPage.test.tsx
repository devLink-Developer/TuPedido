import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GuidedSetupPage } from "./GuidedSetupPage";

const fetchMerchantStoreMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("../../../shared/hooks", () => ({
  useAuthSession: () => ({
    token: "token",
    refresh: refreshMock
  })
}));

vi.mock("../../../shared/services/api", () => ({
  fetchMerchantStore: (...args: unknown[]) => fetchMerchantStoreMock(...args)
}));

vi.mock("../../../shared/components", () => ({
  EmptyState: ({ title, description }: { title: string; description?: string }) => (
    <div>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </div>
  ),
  LoadingCard: ({ label }: { label?: string }) => <div>{label ?? "Cargando..."}</div>
}));

const baseProduct = {
  id: 100,
  store_id: 1,
  product_category_id: 1,
  product_category_name: "Comidas",
  product_subcategory_id: null,
  product_subcategory_name: null,
  sku: "PRD-100",
  name: "Producto activo",
  brand: null,
  barcode: null,
  unit_label: null,
  description: "Producto disponible",
  price: 1000,
  compare_at_price: null,
  final_price: 1000,
  commercial_discount_type: null,
  commercial_discount_value: null,
  commercial_discount_amount: 0,
  commercial_discount_percentage: 0,
  has_commercial_discount: false,
  image_url: null,
  stock_quantity: null,
  max_per_order: null,
  is_available: true,
  sort_order: 0
};

const baseCategory = {
  id: 1,
  name: "Comidas",
  slug: "comidas",
  sort_order: 0,
  subcategories: []
};

function buildStore(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    slug: "mi-local",
    name: "Mi Local",
    description: "Descripcion",
    address: "San Martin 123, Santa Fe, Santa Fe, 3000",
    postal_code: "3000",
    province: "Santa Fe",
    locality: "Santa Fe",
    phone: "3420000000",
    latitude: -31.63,
    longitude: -60.7,
    logo_url: null,
    cover_image_url: null,
    status: "pending_review",
    accepting_orders: false,
    is_open: false,
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
      delivery_enabled: false,
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
      pickup_area_polygon: [],
      pickup_area_uses_delivery_area: true,
      configured_riders_count: 1,
      active_riders_count: 1,
      delivery_unavailable_reason: null
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
    product_categories: [baseCategory],
    products: [baseProduct],
    hours: [],
    ...overrides
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <GuidedSetupPage />
    </MemoryRouter>
  );
}

function getCard(title: string) {
  const card = screen.getByRole("heading", { name: title }).closest("article");
  if (!card) {
    throw new Error(`No card found for ${title}`);
  }
  return within(card);
}

describe("GuidedSetupPage", () => {
  beforeEach(() => {
    fetchMerchantStoreMock.mockReset();
    refreshMock.mockReset();
  });

  it("muestra los pasos en orden con accesos a las pantallas existentes", async () => {
    fetchMerchantStoreMock.mockResolvedValue(buildStore());

    renderPage();

    await waitFor(() => expect(screen.getByText("Configura tu comercio")).toBeInTheDocument());

    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "Direccion y alcance",
      "Taxonomia",
      "Primer articulo",
      "Requisitos para habilitar delivery"
    ]);
    expect(screen.getByRole("link", { name: /Configurar direccion y alcance/i })).toHaveAttribute("href", "/m/alcance");
    expect(screen.getByRole("link", { name: /Crear taxonomia/i })).toHaveAttribute("href", "/m/productos");
    expect(screen.getByRole("link", { name: /Agregar articulo/i })).toHaveAttribute("href", "/m/productos");
    expect(screen.getByRole("link", { name: /Gestionar repartidores/i })).toHaveAttribute("href", "/m/riders");
  });

  it("marca pendiente direccion, taxonomia y primer articulo cuando faltan datos base", async () => {
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
          min_order: 0,
          delivery_area_polygon: [],
          pickup_area_polygon: [],
          pickup_area_uses_delivery_area: false,
          configured_riders_count: 0,
          active_riders_count: 0,
          delivery_unavailable_reason: null
        },
        product_categories: [],
        products: []
      })
    );

    renderPage();

    await waitFor(() => expect(screen.getByText("Configura tu comercio")).toBeInTheDocument());

    expect(getCard("Direccion y alcance").getByText("Pendiente")).toBeInTheDocument();
    expect(getCard("Taxonomia").getByText("Pendiente")).toBeInTheDocument();
    expect(getCard("Primer articulo").getByText("Pendiente")).toBeInTheDocument();
  });

  it("muestra envio como no habilitable si falta un repartidor activo", async () => {
    fetchMerchantStoreMock.mockResolvedValue(
      buildStore({
        delivery_settings: {
          delivery_enabled: false,
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
          pickup_area_polygon: [],
          pickup_area_uses_delivery_area: true,
          configured_riders_count: 1,
          active_riders_count: 0,
          delivery_unavailable_reason: "No hay repartidores activos para este comercio."
        }
      })
    );

    renderPage();

    await waitFor(() => expect(screen.getByText("Configura tu comercio")).toBeInTheDocument());

    const deliverySection = screen.getByRole("heading", { name: "Requisitos para habilitar delivery" }).closest("section");
    if (!deliverySection) {
      throw new Error("No delivery section found");
    }
    expect(within(deliverySection).getByText("No habilitable")).toBeInTheDocument();
    expect(within(deliverySection).getByText("Al menos un repartidor activo.")).toBeInTheDocument();
  });
});
