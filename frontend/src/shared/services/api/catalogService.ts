import type { CatalogBanner, Category, PlatformBranding, StoreDetail, StoreSummary } from "../../types";
import { apiRequest } from "./client";

export async function fetchCategories(): Promise<Category[]> {
  return apiRequest<Category[]>("/catalog/categories");
}

export async function fetchCatalogBanner(): Promise<CatalogBanner> {
  return apiRequest<CatalogBanner>("/catalog/platform-banner");
}

export async function fetchPlatformBranding(): Promise<PlatformBranding> {
  return apiRequest<PlatformBranding>("/catalog/platform-branding");
}

export async function fetchStores(params: {
  categorySlug?: string;
  search?: string;
  deliveryMode?: string;
} = {}): Promise<StoreSummary[]> {
  const search = new URLSearchParams();
  if (params.categorySlug) search.set("category_slug", params.categorySlug);
  if (params.search) search.set("search", params.search);
  if (params.deliveryMode) search.set("delivery_mode", params.deliveryMode);
  const query = search.toString() ? `?${search.toString()}` : "";
  return apiRequest<StoreSummary[]>(`/catalog/stores${query}`);
}

export async function fetchStore(slug: string): Promise<StoreDetail> {
  return apiRequest<StoreDetail>(`/catalog/stores/${slug}`);
}

export async function fetchStoreById(storeId: number): Promise<StoreDetail> {
  const stores = await fetchStores();
  const store = stores.find((item) => item.id === storeId);
  if (!store) {
    throw new Error("El backend todavía no expone detalle de comercio por id");
  }
  return fetchStore(store.slug);
}
