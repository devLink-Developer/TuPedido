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
});
