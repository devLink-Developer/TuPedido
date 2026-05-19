import { afterEach, describe, expect, it, vi } from "vitest";
import {
  API_NETWORK_ERROR_MESSAGE,
  apiRequest,
  apiRootFromBaseUrl,
  buildCatalogSocketUrl,
  normalizeApiBaseUrl,
  normalizeApiPayload,
  resolveApiMediaUrl
} from "./client";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("api client URL helpers", () => {
  it("keeps default api prefix normalized", () => {
    expect(normalizeApiBaseUrl("https://kepedimos.com/api/v1/")).toBe("https://kepedimos.com/api/v1");
  });

  it("resolves the API root outside /api/v1", () => {
    expect(apiRootFromBaseUrl("https://kepedimos.com/api/v1")).toBe("https://kepedimos.com");
  });

  it("resolves relative media URLs against the backend root", () => {
    expect(resolveApiMediaUrl("/media/products/demo.png", "https://kepedimos.com/api/v1")).toBe(
      "https://kepedimos.com/media/products/demo.png"
    );
  });

  it("builds the public catalog websocket URL", () => {
    expect(buildCatalogSocketUrl()).toBe("wss://kepedimos.com/api/v1/ws/catalog/stores");
  });

  it("normalizes nested media payloads", () => {
    const payload = normalizeApiPayload(
      { logo_url: "/media/stores/logo.png", items: [{ image_url: "/media/products/a.png" }] },
      "https://host/api/v1"
    );
    expect(payload.logo_url).toBe("https://host/media/stores/logo.png");
    expect(payload.items[0].image_url).toBe("https://host/media/products/a.png");
  });

  it("converts request timeouts into API errors", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const error = new Error("Aborted");
            error.name = "AbortError";
            reject(error);
          });
        });
      })
    );

    const request = expect(apiRequest("/slow", { timeoutMs: 25 })).rejects.toMatchObject({
      status: 0,
      message: "La conexion tardo mas de lo esperado. Intenta nuevamente.",
      diagnostics: {
        path: "/slow",
        method: "GET",
        timeoutMs: 25,
        appVersion: "1.0.41",
        appBuildNumber: "42"
      }
    });
    await vi.advanceTimersByTimeAsync(25);
    await request;
  });

  it("adds endpoint diagnostics to network errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("Network request failed")))
    );

    await expect(apiRequest("/catalog/categories")).rejects.toMatchObject({
      status: 0,
      message: API_NETWORK_ERROR_MESSAGE,
      diagnostics: {
        path: "/catalog/categories",
        method: "GET",
        nativeError: "Network request failed",
        appVersion: "1.0.41",
        appBuildNumber: "42"
      }
    });
  });
});
