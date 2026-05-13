import { describe, expect, it } from "vitest";
import { apiRootFromBaseUrl, buildCatalogSocketUrl, normalizeApiBaseUrl, normalizeApiPayload, resolveApiMediaUrl } from "./client";

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
});
