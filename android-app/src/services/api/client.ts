import { API_BASE_URL, APP_BUILD_NUMBER, APP_VERSION, DEFAULT_API_BASE_URL } from "../../config/env";

export type RequestOptions = RequestInit & {
  token?: string | null;
  timeoutMs?: number;
};

export type ApiDiagnostic = {
  url: string;
  path: string;
  method: string;
  timeoutMs: number;
  elapsedMs: number;
  appVersion: string;
  appBuildNumber: string;
  requestedAt: string;
  status?: number;
  statusText?: string;
  contentType?: string | null;
  nativeError?: string | null;
};

export const DEFAULT_REQUEST_TIMEOUT_MS = 20000;
export const API_TIMEOUT_ERROR_MESSAGE = "La conexion tardo mas de lo esperado. Intenta nuevamente.";
export const API_NETWORK_ERROR_MESSAGE = "No pudimos conectar con KePedimos. Revisa la conexion e intenta de nuevo.";

export class ApiError extends Error {
  status: number;
  detail: unknown;
  diagnostics?: ApiDiagnostic;

  constructor(message: string, status: number, detail: unknown, diagnostics?: ApiDiagnostic) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.diagnostics = diagnostics;
  }
}

function requestMethod(options: RequestInit): string {
  return String(options.method ?? "GET").toUpperCase();
}

function createDiagnostic(
  path: string,
  url: string,
  method: string,
  timeoutMs: number,
  startedAt: number,
  overrides: Partial<ApiDiagnostic> = {}
): ApiDiagnostic {
  return {
    url,
    path,
    method,
    timeoutMs,
    elapsedMs: Date.now() - startedAt,
    appVersion: APP_VERSION,
    appBuildNumber: APP_BUILD_NUMBER,
    requestedAt: new Date(startedAt).toISOString(),
    ...overrides
  };
}

function logNetworkDiagnostic(diagnostic: ApiDiagnostic) {
  if (typeof process !== "undefined" && process.env?.NODE_ENV === "test") return;
  console.warn("[KePedimos API]", diagnostic);
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
  const { token, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS, signal: requestSignal, ...fetchOptions } = options;
  const headers = new Headers(options.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const requestUrl = `${API_BASE_URL}${path}`;
  const method = requestMethod(fetchOptions);
  const startedAt = Date.now();
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
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
    response = await fetch(requestUrl, {
      ...fetchOptions,
      headers,
      signal: controller.signal
    });
  } catch (error) {
    const nativeError = error instanceof Error ? error.message : String(error ?? "");
    const diagnostic = createDiagnostic(path, requestUrl, method, timeoutMs, startedAt, { nativeError });
    logNetworkDiagnostic(diagnostic);
    if (timedOut) {
      throw new ApiError(API_TIMEOUT_ERROR_MESSAGE, 0, null, diagnostic);
    }
    if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
      throw new ApiError("Request aborted", 0, null, diagnostic);
    }
    throw new ApiError(API_NETWORK_ERROR_MESSAGE, 0, nativeError || null, diagnostic);
  } finally {
    clearTimeout(timeoutId);
    requestSignal?.removeEventListener("abort", abortFromRequestSignal);
  }

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    const message = payload?.detail ?? payload?.message ?? `Request failed (${response.status})`;
    throw new ApiError(
      String(message),
      response.status,
      payload,
      createDiagnostic(path, requestUrl, method, timeoutMs, startedAt, {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get("content-type")
      })
    );
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
