import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCategoryStore, useClienteStore } from "../../../shared/stores";
import { CATALOG_STORES_CHANGED_EVENT } from "../../../shared/utils/catalogStores";
import { CatalogPage } from "./CatalogPage";

const fetchCatalogBannerMock = vi.fn();
const fetchStoresMock = vi.fn();
const fetchCategoriesMock = vi.fn();

vi.mock("../../../shared/services/api", () => ({
  fetchCatalogBanner: (...args: unknown[]) => fetchCatalogBannerMock(...args),
  fetchStores: (...args: unknown[]) => fetchStoresMock(...args),
  fetchCategories: (...args: unknown[]) => fetchCategoriesMock(...args)
}));

vi.mock("../components/StoreList", () => ({
  StoreList: ({ stores }: { stores: Array<{ id: number }> }) => <div>{stores.length} comercios</div>
}));

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

describe("CatalogPage", () => {
  beforeEach(() => {
    vi.useRealTimers();
    fetchCatalogBannerMock.mockReset();
    fetchStoresMock.mockReset();
    fetchCategoriesMock.mockReset();
    useCategoryStore.getState().resetForTest();
    useClienteStore.getState().resetCatalog();
    document.documentElement.style.removeProperty("--catalog-accent");
    document.documentElement.style.removeProperty("--catalog-accent-light");
    document.documentElement.style.removeProperty("--catalog-accent-soft");
    document.documentElement.style.removeProperty("--catalog-accent-border");
    document.documentElement.style.removeProperty("--catalog-accent-shadow");
    document.documentElement.style.removeProperty("--page-glow");
    fetchCatalogBannerMock.mockResolvedValue({
      catalog_banner_image_url: null,
      catalog_banner_width: 1600,
      catalog_banner_height: 520
    });
    fetchCategoriesMock.mockResolvedValue([]);
    fetchStoresMock.mockResolvedValue([]);
  });

  it("carga todos los comercios cuando no hay filtro de entrega en la URL", async () => {
    render(
      <MemoryRouter initialEntries={["/c"]}>
        <CatalogPage />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(fetchStoresMock).toHaveBeenCalledWith({
        categorySlug: undefined,
        search: undefined,
        deliveryMode: undefined
      })
    );
    expect(screen.getByRole("combobox")).toHaveValue("");
  });

  it("mantiene el filtro de entrega cuando viene en la URL", async () => {
    render(
      <MemoryRouter initialEntries={["/c?delivery=pickup"]}>
        <CatalogPage />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(fetchStoresMock).toHaveBeenCalledWith({
        categorySlug: undefined,
        search: undefined,
        deliveryMode: "pickup"
      })
    );
    expect(screen.getByRole("combobox")).toHaveValue("pickup");
  });

  it("aplica el color del rubro seleccionado al contexto del catalogo", async () => {
    useCategoryStore.getState().setCategories([
      {
        id: 7,
        name: "Farmacia",
        slug: "farmacia",
        description: null,
        color: "#22C55E",
        color_light: "#DCFCE7",
        icon: "FX",
        is_active: true,
        sort_order: 1
      }
    ]);

    render(
      <MemoryRouter initialEntries={["/c?category=farmacia"]}>
        <CatalogPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(document.documentElement.style.getPropertyValue("--catalog-accent")).toBe("#22C55E"));
    expect(screen.getByText("Estas viendo Farmacia")).toBeInTheDocument();
  });

  it("revalida el listado al cambiar la venta sin mostrar de nuevo el loading", async () => {
    const refreshRequest = createDeferred<Array<{ id: number }>>();
    fetchStoresMock.mockResolvedValueOnce([{ id: 1 }]);
    fetchStoresMock.mockImplementationOnce(() => refreshRequest.promise);

    render(
      <MemoryRouter initialEntries={["/c"]}>
        <CatalogPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("1 comercios")).toBeInTheDocument());

    window.dispatchEvent(new Event(CATALOG_STORES_CHANGED_EVENT));

    await waitFor(() => expect(fetchStoresMock).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("Cargando...")).not.toBeInTheDocument();
    expect(screen.getByText("1 comercios")).toBeInTheDocument();

    refreshRequest.resolve([{ id: 1 }, { id: 2 }]);

    await waitFor(() => expect(screen.getByText("2 comercios")).toBeInTheDocument());
  });

  it("revalida periodicamente el listado sin parpadeo", async () => {
    const refreshRequest = createDeferred<Array<{ id: number }>>();
    let intervalCallback: VoidFunction | null = null;
    const setIntervalSpy = vi.spyOn(window, "setInterval").mockImplementation(((handler: TimerHandler, timeout?: number) => {
      if (timeout === 5000 && typeof handler === "function") {
        intervalCallback = handler as VoidFunction;
      }
      return 1 as unknown as number;
    }) as typeof window.setInterval);
    const clearIntervalSpy = vi.spyOn(window, "clearInterval").mockImplementation(() => undefined);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible"
    });
    fetchStoresMock.mockResolvedValueOnce([{ id: 1 }]);
    fetchStoresMock.mockImplementationOnce(() => refreshRequest.promise);

    render(
      <MemoryRouter initialEntries={["/c"]}>
        <CatalogPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("1 comercios")).toBeInTheDocument());

    expect(intervalCallback).not.toBeNull();
    const callback = intervalCallback;
    if (!callback) {
      throw new Error("No se registro el polling del catalogo");
    }
    (callback as VoidFunction)();

    await waitFor(() => expect(fetchStoresMock).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("Cargando...")).not.toBeInTheDocument();
    expect(screen.getByText("1 comercios")).toBeInTheDocument();

    refreshRequest.resolve([]);

    await waitFor(() => expect(screen.getByText("No hay comercios para ese filtro")).toBeInTheDocument());
    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });
});
