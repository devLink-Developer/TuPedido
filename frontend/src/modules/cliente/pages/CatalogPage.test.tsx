import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCategoryStore } from "../../../shared/stores";
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
    fetchCatalogBannerMock.mockReset();
    fetchStoresMock.mockReset();
    fetchCategoriesMock.mockReset();
    useCategoryStore.getState().setCategories([]);
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
});
