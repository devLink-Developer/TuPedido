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
  latitude?: number;
  longitude?: number;
} = {}): Promise<StoreSummary[]> {
  const search = new URLSearchParams();
  if (params.categorySlug) search.set("category_slug", params.categorySlug);
  if (params.search) search.set("search", params.search);
  if (params.deliveryMode) search.set("delivery_mode", params.deliveryMode);
  if (params.latitude !== undefined) search.set("latitude", String(params.latitude));
  if (params.longitude !== undefined) search.set("longitude", String(params.longitude));
  const query = search.toString() ? `?${search.toString()}` : "";
  return apiRequest<StoreSummary[]>(`/catalog/stores${query}`);
}

export async function fetchStore(
  slug: string,
  params: { latitude?: number; longitude?: number; deliveryMode?: string } = {}
): Promise<StoreDetail> {
  const search = new URLSearchParams();
  if (params.latitude !== undefined) search.set("latitude", String(params.latitude));
  if (params.longitude !== undefined) search.set("longitude", String(params.longitude));
  if (params.deliveryMode) search.set("delivery_mode", params.deliveryMode);
  const query = search.toString() ? `?${search.toString()}` : "";
  return apiRequest<StoreDetail>(`/catalog/stores/${encodeURIComponent(slug)}${query}`);
}

export async function fetchStoreById(
  storeId: number,
  params: { latitude?: number; longitude?: number; deliveryMode?: string } = {}
): Promise<StoreDetail> {
  const stores = await fetchStores(params);
  const store = stores.find((item) => item.id === storeId);
  if (!store) {
    throw new Error("El backend todavía no expone detalle de comercio por id");
  }
  return fetchStore(store.slug, params);
}
