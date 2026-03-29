import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCategoryStore } from "../../../shared/stores";
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
});
