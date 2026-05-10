import { describe, expect, it } from "vitest";
import { buildLeafletMapHtml, normalizeLeafletMapPoints, sanitizeMapColor } from "./leafletMap";

describe("normalizeLeafletMapPoints", () => {
  it("keeps only finite coordinates inside Leaflet bounds", () => {
    expect(
      normalizeLeafletMapPoints([
        { id: "store", label: "Comercio", latitude: -34.6, longitude: -58.38, color: "#EA580C" },
        { id: "missing", label: "Sin ubicacion", latitude: null, longitude: -58.39, color: "#2563EB" },
        { id: "bad-lat", label: "Latitud invalida", latitude: 120, longitude: -58.39, color: "#047857" },
        { id: "bad-lng", label: "Longitud invalida", latitude: -34.61, longitude: -220, color: "#047857" }
      ])
    ).toEqual([{ id: "store", label: "Comercio", latitude: -34.6, longitude: -58.38, color: "#EA580C" }]);
  });

  it("falls back to the default marker color for unsafe colors", () => {
    expect(
      normalizeLeafletMapPoints([
        { id: "rider", label: "Repartidor", latitude: -34.61, longitude: -58.39, color: "red; display:none" }
      ])
    ).toEqual([{ id: "rider", label: "Repartidor", latitude: -34.61, longitude: -58.39, color: "#EA580C" }]);
  });
});

describe("sanitizeMapColor", () => {
  it("accepts hex colors and rejects arbitrary CSS", () => {
    expect(sanitizeMapColor("#fff")).toBe("#fff");
    expect(sanitizeMapColor("#123456")).toBe("#123456");
    expect(sanitizeMapColor("#12345", "#000000")).toBe("#000000");
    expect(sanitizeMapColor("rgb(0, 0, 0)", "#000000")).toBe("#000000");
  });
});

describe("buildLeafletMapHtml", () => {
  it("uses OpenStreetMap tiles and does not reference Google Maps", () => {
    const html = buildLeafletMapHtml({
      points: [{ id: "store", label: "Comercio", latitude: -34.6, longitude: -58.38, color: "#EA580C" }]
    });

    expect(html).toContain("tile.openstreetmap.org");
    expect(html.toLowerCase()).not.toContain("google");
  });

  it("enables mobile touch zoom gestures", () => {
    const html = buildLeafletMapHtml({
      points: [{ id: "store", label: "Comercio", latitude: -34.6, longitude: -58.38, color: "#EA580C" }]
    });

    expect(html).toContain('touchZoom: "center"');
    expect(html).toContain("touch-action: none");
    expect(html).toContain("map.touchZoom.enable()");
  });

  it("escapes point labels before embedding JSON in the inline script", () => {
    const html = buildLeafletMapHtml({
      points: [{ id: "x", label: "</script><script>alert(1)</script>", latitude: -34.6, longitude: -58.38, color: "#EA580C" }]
    });

    expect(html).toContain("\\u003C/script\\u003E");
    expect(html).not.toContain("</script><script>alert(1)</script>");
  });
});
