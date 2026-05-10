import type { CatalogBanner, Category, PlatformBranding, StoreDetail, StoreSummary } from "../../types/api";
import { apiRequest } from "./client";

export function fetchCategories(): Promise<Category[]> {
  return apiRequest<Category[]>("/catalog/categories");
}

export function fetchPlatformBranding(): Promise<PlatformBranding> {
  return apiRequest<PlatformBranding>("/catalog/platform-branding");
}

export function fetchCatalogBanner(): Promise<CatalogBanner> {
  return apiRequest<CatalogBanner>("/catalog/platform-banner");
}

export function fetchStores(params: { categorySlug?: string; search?: string; deliveryMode?: "delivery" | "pickup" } = {}): Promise<StoreSummary[]> {
  const search = new URLSearchParams();
  if (params.categorySlug) search.set("category_slug", params.categorySlug);
  if (params.search) search.set("search", params.search);
  if (params.deliveryMode) search.set("delivery_mode", params.deliveryMode);
  const query = search.toString() ? `?${search.toString()}` : "";
  return apiRequest<StoreSummary[]>(`/catalog/stores${query}`);
}

export function fetchStore(slug: string): Promise<StoreDetail> {
  return apiRequest<StoreDetail>(`/catalog/stores/${encodeURIComponent(slug)}`);
}
