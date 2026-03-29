import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useClienteStore } from "../../../shared/stores";
import { CheckoutPage } from "./CheckoutPage";

const navigateMock = vi.fn();
const checkoutMock = vi.fn();
const fetchAddressesMock = vi.fn();
const fetchStoreByIdMock = vi.fn();
const resetCartMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock
  };
});

vi.mock("../../../shared/hooks", () => ({
  useAuthSession: () => ({ token: "token" }),
  useCart: () => ({
    cart: {
      id: 1,
      store_id: 15,
      store_name: "Mi Tienda",
      store_slug: "mi-tienda",
      delivery_mode: "pickup" as const,
      delivery_settings: {
        delivery_enabled: true,
        pickup_enabled: true,
        delivery_fee: 0,
        min_order: 0
      },
      subtotal: 1000,
      commercial_discount_total: 0,
      financial_discount_total: 0,
      delivery_fee: 0,
      service_fee: 100,
      total: 1100,
      items: [
        {
          id: 1,
          product_id: 7,
          product_name: "Pizza",
          base_unit_price: 1000,
          unit_price: 1000,
          commercial_discount_amount: 0,
          quantity: 1,
          note: null
        }
      ],
      pricing: {
        subtotal: 1000,
        commercialDiscountTotal: 0,
        financialDiscountTotal: 0,
        deliveryFee: 0,
        serviceFee: 100,
        total: 1100,
        complete: true
      }
    },
    resetCart: () => resetCartMock()
  })
}));

vi.mock("../../../shared/services/api", () => ({
  checkout: (...args: unknown[]) => checkoutMock(...args),
  createAddress: vi.fn(),
  fetchAddresses: (...args: unknown[]) => fetchAddressesMock(...args),
  fetchStoreById: (...args: unknown[]) => fetchStoreByIdMock(...args)
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

vi.mock("../components/CheckoutSummary", () => ({
  CheckoutSummary: () => <div>Resumen</div>
}));

vi.mock("../components/AddressFormCard", () => ({
  AddressFormCard: () => <div>Formulario direccion</div>,
  emptyAddressForm: {
    label: "",
    postalCode: "",
    province: "",
    locality: "",
    street: "",
    streetNumber: "",
    floor: "",
    apartment: "",
    reference: "",
    latitude: "",
    longitude: ""
  },
  getAddressMissingFields: () => [],
  hasAddressGeolocation: () => true,
  toAddressPayload: () => null
}));

describe("CheckoutPage", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    checkoutMock.mockReset();
    fetchAddressesMock.mockReset();
    fetchStoreByIdMock.mockReset();
    resetCartMock.mockReset();

    fetchAddressesMock.mockResolvedValue([]);
    fetchStoreByIdMock.mockResolvedValue({
      id: 15,
      slug: "mi-tienda",
      name: "Mi Tienda",
      description: "Descripcion",
      address: "San Martin 123",
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
    });
    checkoutMock.mockResolvedValue({
      order_id: 99,
      status: "created",
      payment_status: "pending",
      payment_reference: null,
      checkout_url: null
    });
  });

  it("vacía el carrito local al confirmar un pedido en efectivo", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <CheckoutPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByRole("button", { name: "Confirmar pedido" })).toBeInTheDocument());
    expect(useClienteStore.getState().selectedPaymentMethod).toBe("cash");

    await user.click(screen.getByRole("button", { name: "Confirmar pedido" }));

    await waitFor(() =>
      expect(checkoutMock).toHaveBeenCalledWith("token", {
        store_id: 15,
        address_id: null,
        delivery_mode: "pickup",
        payment_method: "cash"
      })
    );
    expect(resetCartMock).toHaveBeenCalledTimes(1);
    expect(useClienteStore.getState().selectedAddressId).toBe("");
    expect(useClienteStore.getState().selectedPaymentMethod).toBe("cash");
    expect(navigateMock).toHaveBeenCalledWith("/c/pedido/99", { replace: true });
  });
});
