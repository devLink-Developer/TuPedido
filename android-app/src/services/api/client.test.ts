import { describe, expect, it } from "vitest";
import { apiRootFromBaseUrl, buildCatalogSocketUrl, normalizeApiBaseUrl, normalizeApiPayload, resolveApiMediaUrl } from "./client";

describe("api client URL helpers", () => {
  it("keeps default api prefix normalized", () => {
    expect(normalizeApiBaseUrl("http://200.58.107.187:8016/api/v1/")).toBe("http://200.58.107.187:8016/api/v1");
  });

  it("resolves the API root outside /api/v1", () => {
    expect(apiRootFromBaseUrl("http://200.58.107.187:8016/api/v1")).toBe("http://200.58.107.187:8016");
  });

  it("resolves relative media URLs against the backend root", () => {
    expect(resolveApiMediaUrl("/media/products/demo.png", "http://200.58.107.187:8016/api/v1")).toBe(
      "http://200.58.107.187:8016/media/products/demo.png"
    );
  });

  it("builds the public catalog websocket URL", () => {
    expect(buildCatalogSocketUrl()).toBe("ws://200.58.107.187:8016/api/v1/ws/catalog/stores");
  });

  it("normalizes nested media payloads", () => {
    const payload = normalizeApiPayload(
      { logo_url: "/media/stores/logo.png", items: [{ image_url: "/media/products/a.png" }] },
      "http://host:8016/api/v1"
    );
    expect(payload.logo_url).toBe("http://host:8016/media/stores/logo.png");
    expect(payload.items[0].image_url).toBe("http://host:8016/media/products/a.png");
  });
});
