const DEFAULT_API_BASE_URL = "https://kepedimos.com/api/v1";

function resolveApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    if (window.location.hostname === "kepedimos.com") {
      return "/api/v1";
    }
  }

  return DEFAULT_API_BASE_URL;
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
    return true;
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
    return new URL(value, "https://kepedimos.com");
  }
}

function resolveApiRootUrl(): URL {
  const baseUrl = resolveUrl(API_BASE_URL);
  baseUrl.pathname = baseUrl.pathname.replace(/\/api\/v1\/?$/, "") || "/";
  baseUrl.search = "";
  baseUrl.hash = "";
  return baseUrl;
}

export function resolveApiMediaUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith("/media/")) {
    return value;
  }

  const rootUrl = resolveApiRootUrl();
  rootUrl.pathname = `${rootUrl.pathname.replace(/\/$/, "")}${trimmed}`;
  return rootUrl.toString();
}

function normalizeApiPayload<T>(payload: T): T {
  if (typeof payload === "string") {
    return resolveApiMediaUrl(payload) as T;
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => normalizeApiPayload(item)) as T;
  }

  if (payload && typeof payload === "object") {
    return Object.fromEntries(
      Object.entries(payload).map(([key, value]) => [key, normalizeApiPayload(value)])
    ) as T;
  }

  return payload;
}

type RequestOptions = RequestInit & {
  token?: string | null;
  timeoutMs?: number;
};

export const DEFAULT_REQUEST_TIMEOUT_MS = 20000;
export const API_TIMEOUT_ERROR_MESSAGE = "La conexion tardo mas de lo esperado. Intenta nuevamente.";
export const API_NETWORK_ERROR_MESSAGE = "No pudimos conectar con KePedimos. Revisa tu conexion e intenta de nuevo.";

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

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS, signal: requestSignal, ...fetchOptions } = options;
  const headers = new Headers(options.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const abortFromRequestSignal = () => controller.abort();
  if (requestSignal) {
    if (requestSignal.aborted) {
      controller.abort();
    } else {
      requestSignal.addEventListener("abort", abortFromRequestSignal, { once: true });
    }
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...fetchOptions,
      headers,
      signal: controller.signal
    });
  } catch (requestError) {
    if (timedOut) {
      throw new ApiError(API_TIMEOUT_ERROR_MESSAGE, 0, null);
    }
    if (controller.signal.aborted || (requestError instanceof Error && requestError.name === "AbortError")) {
      throw new ApiError("Request aborted", 0, null);
    }
    throw new ApiError(API_NETWORK_ERROR_MESSAGE, 0, requestError instanceof Error ? requestError.message : null);
  } finally {
    window.clearTimeout(timeoutId);
    requestSignal?.removeEventListener("abort", abortFromRequestSignal);
  }

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : null;
  if (!response.ok) {
    const message = payload?.detail ?? payload?.message ?? `Request failed (${response.status})`;
    throw new ApiError(String(message), response.status, payload);
  }

  return normalizeApiPayload(payload as T);
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
