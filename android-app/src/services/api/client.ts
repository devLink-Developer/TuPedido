import { API_BASE_URL, DEFAULT_API_BASE_URL } from "../../config/env";

export type RequestOptions = RequestInit & {
  token?: string | null;
};

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(message: string, status: number, detail: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export function normalizeApiBaseUrl(value: string | null | undefined): string {
  const cleaned = value?.trim().replace(/\/+$/, "");
  return cleaned || DEFAULT_API_BASE_URL;
}

export function apiRootFromBaseUrl(apiBaseUrl = API_BASE_URL): string {
  return normalizeApiBaseUrl(apiBaseUrl).replace(/\/api\/v1\/?$/, "");
}

export function resolveApiMediaUrl(value: string, apiBaseUrl = API_BASE_URL): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith("/media/")) {
    return value;
  }
  return `${apiRootFromBaseUrl(apiBaseUrl)}${trimmed}`;
}

export function normalizeApiPayload<T>(payload: T, apiBaseUrl = API_BASE_URL): T {
  if (typeof payload === "string") {
    return resolveApiMediaUrl(payload, apiBaseUrl) as T;
  }
  if (Array.isArray(payload)) {
    return payload.map((item) => normalizeApiPayload(item, apiBaseUrl)) as T;
  }
  if (payload && typeof payload === "object") {
    return Object.fromEntries(
      Object.entries(payload).map(([key, value]) => [key, normalizeApiPayload(value, apiBaseUrl)])
    ) as T;
  }
  return payload;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    const message = payload?.detail ?? payload?.message ?? `Request failed (${response.status})`;
    throw new ApiError(String(message), response.status, payload);
  }

  return normalizeApiPayload(payload as T);
}

function socketBaseUrl(): URL {
  const baseUrl = new URL(API_BASE_URL);
  baseUrl.protocol = baseUrl.protocol === "https:" ? "wss:" : "ws:";
  baseUrl.pathname = baseUrl.pathname.replace(/\/api\/v1\/?$/, "/api/v1");
  baseUrl.search = "";
  baseUrl.hash = "";
  return baseUrl;
}

export function buildNotificationsSocketUrl(token: string): string {
  const baseUrl = socketBaseUrl();
  baseUrl.pathname = `${baseUrl.pathname.replace(/\/$/, "")}/ws/notifications/me`;
  baseUrl.search = `token=${encodeURIComponent(token)}`;
  return baseUrl.toString();
}

export function buildCatalogSocketUrl(): string {
  const baseUrl = socketBaseUrl();
  baseUrl.pathname = `${baseUrl.pathname.replace(/\/$/, "")}/ws/catalog/stores`;
  baseUrl.search = "";
  return baseUrl.toString();
}

export function buildDeliverySocketUrl(token: string): string {
  const baseUrl = socketBaseUrl();
  baseUrl.pathname = `${baseUrl.pathname.replace(/\/$/, "")}/ws/delivery/me`;
  baseUrl.search = `token=${encodeURIComponent(token)}`;
  return baseUrl.toString();
}

export function buildOrderSocketUrl(token: string, orderId: number): string {
  const baseUrl = socketBaseUrl();
  baseUrl.pathname = `${baseUrl.pathname.replace(/\/$/, "")}/ws/orders/${orderId}`;
  baseUrl.search = `token=${encodeURIComponent(token)}`;
  return baseUrl.toString();
}
