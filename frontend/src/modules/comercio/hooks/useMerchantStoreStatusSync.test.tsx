import { render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MerchantStore } from "../../../shared/types";
import { useMerchantStoreStatusSync } from "./useMerchantStoreStatusSync";

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

function buildStore(overrides: Partial<MerchantStore> = {}): MerchantStore {
  return {
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

function HookHarness({ paused = false }: { paused?: boolean }) {
  const [store, setStore] = useState<MerchantStore | null>(buildStore());
  useMerchantStoreStatusSync({ paused, store, setStore });

  return (
    <div>
      <span>{store?.status ?? "sin-store"}</span>
      <span>{store?.accepting_orders ? "recibiendo" : "pausado"}</span>
      <span>{store?.is_open ? "abierto" : "cerrado"}</span>
    </div>
  );
}

function renderHarness(initialEntry = "/m") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/m" element={<HookHarness />} />
        <Route path="/c" element={<div>customer home</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("useMerchantStoreStatusSync", () => {
  beforeEach(() => {
    fetchMerchantStoreMock.mockReset();
    refreshMock.mockReset();
  });

  it("actualiza el estado del store al recuperar foco", async () => {
    fetchMerchantStoreMock.mockResolvedValue(
      buildStore({
        status: "suspended",
        accepting_orders: false,
        is_open: false
      })
    );

    renderHarness();

    window.dispatchEvent(new Event("focus"));

    await waitFor(() => expect(fetchMerchantStoreMock).toHaveBeenCalledWith("token"));
    expect(await screen.findByText("suspended")).toBeInTheDocument();
    expect(screen.getByText("pausado")).toBeInTheDocument();
    expect(screen.getByText("cerrado")).toBeInTheDocument();
  });

  it("sincroniza la sesion y redirige si el acceso merchant se pierde", async () => {
    fetchMerchantStoreMock.mockRejectedValue(new Error("forbidden"));
    refreshMock.mockResolvedValue({
      id: 22,
      full_name: "Cliente Demo",
      email: "cliente@example.com",
      role: "customer",
      is_active: true
    });

    renderHarness();

    window.dispatchEvent(new Event("focus"));

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("customer home")).toBeInTheDocument();
  });
});
