const DEFAULT_API_BASE_URL = "http://localhost:8016/api/v1";

function isLocalHostname(hostname: string): boolean {
  return ["localhost", "127.0.0.1"].includes(hostname);
}

function resolveApiBaseUrl(): string {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname && !isLocalHostname(hostname)) {
      return "/api/v1";
    }
  }

  return configuredBaseUrl || DEFAULT_API_BASE_URL;
}

export const API_BASE_URL = resolveApiBaseUrl();

function resolveRealtimeEnabled(): boolean {
  const configuredValue = import.meta.env.VITE_REALTIME_ENABLED?.trim().toLowerCase();
  if (configuredValue === "true") {
    return true;
  }
  if (configuredValue === "false") {
    return false;
  }

  if (typeof window !== "undefined") {
    return isLocalHostname(window.location.hostname);
  }

  return true;
}

export const REALTIME_ENABLED = resolveRealtimeEnabled();

function resolveUrl(value: string): URL {
  try {
    return new URL(value);
  } catch {
    if (typeof window !== "undefined") {
      return new URL(value, window.location.origin);
    }
    return new URL(value, "http://localhost:8015");
  }
}

type RequestOptions = RequestInit & {
  token?: string | null;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
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
    throw new Error(message);
  }

  return payload as T;
}

export function buildOrderSocketUrl(token: string, orderId: number): string {
  const baseUrl = resolveUrl(API_BASE_URL);
  baseUrl.protocol = baseUrl.protocol === "https:" ? "wss:" : "ws:";
  baseUrl.pathname = `${baseUrl.pathname.replace(/\/api\/v1$/, "")}/api/v1/ws/orders/${orderId}`;
  baseUrl.search = `token=${encodeURIComponent(token)}`;
  return baseUrl.toString();
}

export function buildDeliverySocketUrl(token: string): string {
  const baseUrl = resolveUrl(API_BASE_URL);
  baseUrl.protocol = baseUrl.protocol === "https:" ? "wss:" : "ws:";
  baseUrl.pathname = `${baseUrl.pathname.replace(/\/api\/v1$/, "")}/api/v1/ws/delivery/me`;
  baseUrl.search = `token=${encodeURIComponent(token)}`;
  return baseUrl.toString();
}

export function buildMerchantSocketUrl(token: string): string {
  const baseUrl = resolveUrl(API_BASE_URL);
  baseUrl.protocol = baseUrl.protocol === "https:" ? "wss:" : "ws:";
  baseUrl.pathname = `${baseUrl.pathname.replace(/\/api\/v1$/, "")}/api/v1/ws/merchant/me`;
  baseUrl.search = `token=${encodeURIComponent(token)}`;
  return baseUrl.toString();
}

export function buildNotificationsSocketUrl(token: string): string {
  const baseUrl = resolveUrl(API_BASE_URL);
  baseUrl.protocol = baseUrl.protocol === "https:" ? "wss:" : "ws:";
  baseUrl.pathname = `${baseUrl.pathname.replace(/\/api\/v1$/, "")}/api/v1/ws/notifications/me`;
  baseUrl.search = `token=${encodeURIComponent(token)}`;
  return baseUrl.toString();
}
