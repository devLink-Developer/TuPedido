import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CartPage } from "./CartPage";

const useCartMock = vi.fn();

vi.mock("../../../shared/hooks", () => ({
  useCart: () => useCartMock()
}));

vi.mock("../../../shared/components", () => ({
  EmptyState: ({ title, description }: { title: string; description?: string }) => (
    <div>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </div>
  ),
  LoadingCard: () => <div>Cargando...</div>,
  PageHeader: ({ title, action }: { title: string; action?: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {action}
    </div>
  )
}));

vi.mock("../components/CheckoutSummary", () => ({
  CheckoutSummary: () => <div>Resumen</div>
}));

const baseCart = {
  id: 1,
  store_id: 10,
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
      product_id: 50,
      product_name: "Milanesa",
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
};

describe("CartPage", () => {
  beforeEach(() => {
    useCartMock.mockReset();
    useCartMock.mockReturnValue({
      cart: baseCart,
      loading: false,
      error: null,
      updateItem: vi.fn(),
      removeItem: vi.fn(),
      setDeliveryMode: vi.fn(),
      clear: vi.fn()
    });
  });

  it("oculta envio cuando el comercio solo permite retiro", () => {
    useCartMock.mockReturnValue({
      cart: {
        ...baseCart,
        delivery_mode: "pickup",
        delivery_settings: {
          ...baseCart.delivery_settings,
          delivery_enabled: false
        }
      },
      loading: false,
      error: null,
      updateItem: vi.fn(),
      removeItem: vi.fn(),
      setDeliveryMode: vi.fn(),
      clear: vi.fn()
    });

    render(
      <MemoryRouter>
        <CartPage />
      </MemoryRouter>
    );

    expect(screen.queryByRole("button", { name: "Envio" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retiro" })).toBeInTheDocument();
  });

  it("oculta retiro cuando el comercio solo permite envio", () => {
    useCartMock.mockReturnValue({
      cart: {
        ...baseCart,
        delivery_mode: "delivery",
        delivery_settings: {
          ...baseCart.delivery_settings,
          pickup_enabled: false
        }
      },
      loading: false,
      error: null,
      updateItem: vi.fn(),
      removeItem: vi.fn(),
      setDeliveryMode: vi.fn(),
      clear: vi.fn()
    });

    render(
      <MemoryRouter>
        <CartPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("button", { name: "Envio" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retiro" })).not.toBeInTheDocument();
  });
});
