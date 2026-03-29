import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StoresPage } from "./StoresPage";

const fetchAdminApplicationsMock = vi.fn();
const fetchAdminStoresMock = vi.fn();
const fetchAdminCategoriesMock = vi.fn();
const reviewMerchantApplicationMock = vi.fn();
const createAdminStoreMock = vi.fn();
const updateAdminStoreStatusMock = vi.fn();

vi.mock("../../../shared/hooks", () => ({
  useAuthSession: () => ({
    token: "token"
  })
}));

vi.mock("../../../shared/services/api", () => ({
  createAdminStore: (...args: unknown[]) => createAdminStoreMock(...args),
  fetchAdminApplications: (...args: unknown[]) => fetchAdminApplicationsMock(...args),
  fetchAdminCategories: (...args: unknown[]) => fetchAdminCategoriesMock(...args),
  fetchAdminStores: (...args: unknown[]) => fetchAdminStoresMock(...args),
  reviewMerchantApplication: (...args: unknown[]) => reviewMerchantApplicationMock(...args),
  updateAdminStoreStatus: (...args: unknown[]) => updateAdminStoreStatusMock(...args)
}));

vi.mock("../../../shared/components", () => ({
  EmptyState: ({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  ),
  ImageAssetField: ({ label }: { label: string }) => <div>{label}</div>,
  LoadingCard: () => <div>Cargando...</div>,
  PageHeader: ({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  ),
  RubroChip: ({ label, onClick }: { label: string; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {label}
    </button>
  )
}));

vi.mock("../../../shared/ui/Button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>
}));

function createApplication(id: number, overrides?: Partial<Record<string, unknown>>) {
  return {
    id,
    business_name: `Comercio ${id}`,
    description: "Solicitud nueva",
    address: `Calle ${id}`,
    phone: "3420000000",
    status: "pending_review",
    requested_category_ids: [],
    requested_categories: [],
    user_id: id,
    store_id: null,
    store: null,
    created_at: "2026-03-29T12:00:00Z",
    updated_at: "2026-03-29T12:00:00Z",
    review_notes: null,
    ...overrides
  };
}

function createStore(id: number, status: "approved" | "suspended" | "rejected" = "approved") {
  return {
    id,
    slug: `store-${id}`,
    name: `Store ${id}`,
    description: `Descripcion ${id}`,
    address: `Direccion ${id}`,
    postal_code: "3000",
    province: "Santa Fe",
    locality: "Santa Fe",
    phone: "3420000000",
    latitude: null,
    longitude: null,
    logo_url: null,
    cover_image_url: null,
    status,
    accepting_orders: status === "approved",
    is_open: status === "approved",
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
    }
  };
}

describe("StoresPage", () => {
  beforeEach(() => {
    vi.useRealTimers();
    fetchAdminApplicationsMock.mockReset();
    fetchAdminStoresMock.mockReset();
    fetchAdminCategoriesMock.mockReset();
    reviewMerchantApplicationMock.mockReset();
    createAdminStoreMock.mockReset();
    updateAdminStoreStatusMock.mockReset();

    fetchAdminApplicationsMock.mockResolvedValue([]);
    fetchAdminStoresMock.mockResolvedValue([]);
    fetchAdminCategoriesMock.mockResolvedValue([
      {
        id: 1,
        name: "Pizzas",
        is_active: true,
        color: "#111111",
        color_light: "#eeeeee",
        icon: "pizza"
      }
    ]);
  });

  it("revalida solicitudes en segundo plano sin mostrar el loading global otra vez", async () => {
    let intervalCallback: VoidFunction | null = null;
    const setIntervalSpy = vi.spyOn(window, "setInterval").mockImplementation(((handler: TimerHandler, timeout?: number) => {
      if (timeout === 15000 && typeof handler === "function") {
        intervalCallback = handler as VoidFunction;
      }
      return 1 as unknown as number;
    }) as typeof window.setInterval);
    const clearIntervalSpy = vi.spyOn(window, "clearInterval").mockImplementation(() => undefined);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible"
    });

    let resolveRefresh!: (value: ReturnType<typeof createApplication>[]) => void;
    const refreshPromise = new Promise<ReturnType<typeof createApplication>[]>((resolve) => {
      resolveRefresh = resolve;
    });

    fetchAdminApplicationsMock.mockResolvedValueOnce([createApplication(1)]);
    fetchAdminApplicationsMock.mockImplementationOnce(() => refreshPromise);

    render(<StoresPage />);

    await waitFor(() => expect(screen.getByText("Comercio 1")).toBeInTheDocument());

    expect(intervalCallback).not.toBeNull();
    if (!intervalCallback) {
      throw new Error("No se registro el polling de comercios");
    }

    (intervalCallback as VoidFunction)();

    await waitFor(() => expect(fetchAdminApplicationsMock).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("Cargando...")).not.toBeInTheDocument();
    expect(screen.getByText("Comercio 1")).toBeInTheDocument();

    resolveRefresh([createApplication(1), createApplication(2)]);

    await waitFor(() => expect(screen.getByText("Comercio 2")).toBeInTheDocument());
    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });

  it("revisa una solicitud y vuelve a refrescar el listado", async () => {
    const user = userEvent.setup();
    fetchAdminApplicationsMock.mockResolvedValueOnce([createApplication(7)]);
    fetchAdminApplicationsMock.mockResolvedValueOnce([]);
    reviewMerchantApplicationMock.mockResolvedValue(createApplication(7, { status: "approved" }));

    render(<StoresPage />);

    const article = await screen.findByText("Comercio 7");
    const applicationCard = article.closest("article");
    if (!applicationCard) {
      throw new Error("No se encontro la tarjeta de la solicitud");
    }

    await user.click(within(applicationCard).getByRole("button", { name: "Aprobado" }));

    await waitFor(() =>
      expect(reviewMerchantApplicationMock).toHaveBeenCalledWith("token", 7, { status: "approved" })
    );
    await waitFor(() => expect(fetchAdminApplicationsMock).toHaveBeenCalledTimes(2));
  });

  it("muestra una sola accion contextual y oculta comercios rechazados", async () => {
    fetchAdminStoresMock.mockResolvedValueOnce([
      createStore(1, "approved"),
      createStore(2, "suspended"),
      createStore(3, "rejected")
    ]);

    render(<StoresPage />);

    const approvedCard = (await screen.findByText("Store 1")).closest("article");
    const suspendedCard = (await screen.findByText("Store 2")).closest("article");
    if (!approvedCard || !suspendedCard) {
      throw new Error("No se encontraron las tarjetas esperadas");
    }

    expect(screen.queryByText("Store 3")).not.toBeInTheDocument();
    expect(within(approvedCard).getByRole("button", { name: "Suspender" })).toBeInTheDocument();
    expect(within(approvedCard).queryByRole("button", { name: "Reanudar" })).not.toBeInTheDocument();
    expect(within(suspendedCard).getByRole("button", { name: "Reanudar" })).toBeInTheDocument();
    expect(within(suspendedCard).queryByRole("button", { name: "Suspender" })).not.toBeInTheDocument();
  });

  it("actualiza la card inmediatamente al suspender y reanudar sin esperar el refresh", async () => {
    const user = userEvent.setup();
    let resolveRefresh!: (value: ReturnType<typeof createStore>[]) => void;
    const refreshPromise = new Promise<ReturnType<typeof createStore>[]>((resolve) => {
      resolveRefresh = resolve;
    });

    fetchAdminStoresMock.mockResolvedValueOnce([createStore(1, "approved"), createStore(2, "suspended")]);
    fetchAdminStoresMock.mockImplementationOnce(() => refreshPromise);
    updateAdminStoreStatusMock.mockResolvedValueOnce({
      ...createStore(1, "approved"),
      status: "suspended",
      accepting_orders: false,
      is_open: false
    });

    render(<StoresPage />);

    const approvedCard = (await screen.findByText("Store 1")).closest("article");
    if (!approvedCard) {
      throw new Error("No se encontro la tarjeta aprobada");
    }

    await user.click(within(approvedCard).getByRole("button", { name: "Suspender" }));

    await waitFor(() =>
      expect(updateAdminStoreStatusMock).toHaveBeenCalledWith("token", 1, { status: "suspended" })
    );
    expect(within(approvedCard).getByText("Suspendido")).toBeInTheDocument();
    expect(within(approvedCard).getByRole("button", { name: "Reanudar" })).toBeInTheDocument();
    expect(screen.queryByText("Cargando...")).not.toBeInTheDocument();

    resolveRefresh([createStore(1, "suspended"), createStore(2, "suspended")]);
    await waitFor(() => expect(fetchAdminStoresMock).toHaveBeenCalledTimes(2));
  });

  it("reanuda un comercio suspendido y cambia la card de inmediato", async () => {
    const user = userEvent.setup();
    let resolveRefresh!: (value: ReturnType<typeof createStore>[]) => void;
    const refreshPromise = new Promise<ReturnType<typeof createStore>[]>((resolve) => {
      resolveRefresh = resolve;
    });

    fetchAdminStoresMock.mockResolvedValueOnce([createStore(9, "suspended")]);
    fetchAdminStoresMock.mockImplementationOnce(() => refreshPromise);
    updateAdminStoreStatusMock.mockResolvedValueOnce({
      ...createStore(9, "suspended"),
      status: "approved",
      accepting_orders: false,
      is_open: false
    });

    render(<StoresPage />);

    const suspendedCard = (await screen.findByText("Store 9")).closest("article");
    if (!suspendedCard) {
      throw new Error("No se encontro la tarjeta suspendida");
    }

    await user.click(within(suspendedCard).getByRole("button", { name: "Reanudar" }));

    await waitFor(() =>
      expect(updateAdminStoreStatusMock).toHaveBeenCalledWith("token", 9, { status: "approved" })
    );
    expect(within(suspendedCard).getByText("Aprobado")).toBeInTheDocument();
    expect(within(suspendedCard).getByRole("button", { name: "Suspender" })).toBeInTheDocument();

    resolveRefresh([
      {
        ...createStore(9, "approved"),
        accepting_orders: false,
        is_open: false
      }
    ]);
    await waitFor(() => expect(fetchAdminStoresMock).toHaveBeenCalledTimes(2));
  });

  it("bloquea solo la card en curso mientras actualiza el comercio", async () => {
    const user = userEvent.setup();
    let resolveUpdate!: (value: ReturnType<typeof createStore>) => void;
    const updatePromise = new Promise<ReturnType<typeof createStore>>((resolve) => {
      resolveUpdate = resolve;
    });

    fetchAdminStoresMock.mockResolvedValueOnce([createStore(1, "approved"), createStore(2, "approved")]);
    fetchAdminStoresMock.mockResolvedValueOnce([createStore(1, "suspended"), createStore(2, "approved")]);
    updateAdminStoreStatusMock.mockImplementationOnce(() => updatePromise);

    render(<StoresPage />);

    const firstCard = (await screen.findByText("Store 1")).closest("article");
    const secondCard = (await screen.findByText("Store 2")).closest("article");
    if (!firstCard || !secondCard) {
      throw new Error("No se encontraron las tarjetas de comercio");
    }

    await user.click(within(firstCard).getByRole("button", { name: "Suspender" }));

    expect(within(firstCard).getByRole("button", { name: "Suspendiendo..." })).toBeDisabled();
    expect(within(secondCard).getByRole("button", { name: "Suspender" })).not.toBeDisabled();

    resolveUpdate({
      ...createStore(1, "approved"),
      status: "suspended",
      accepting_orders: false,
      is_open: false
    });

    await waitFor(() => expect(within(firstCard).getByRole("button", { name: "Reanudar" })).toBeInTheDocument());
  });
});
