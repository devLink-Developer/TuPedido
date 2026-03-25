import { describe, expect, it } from "vitest";
import { buildLightColor, resolveCategoryPalette } from "./categoryTheme";

describe("categoryTheme", () => {
  it("genera colorLight con alpha cuando falta", () => {
    expect(buildLightColor("#FF3D00")).toBe("#FF3D001A");
  });

  it("mantiene color_light explicito si viene informado", () => {
    expect(resolveCategoryPalette({ color: "#FF3D00", color_light: "#FFF0EB" })).toEqual({
      color: "#FF3D00",
      colorLight: "#FFF0EB"
    });
  });

  it("resuelve fallback con alpha cuando color_light no existe", () => {
    expect(resolveCategoryPalette({ color: "#26A69A", color_light: null })).toEqual({
      color: "#26A69A",
      colorLight: "#26A69A1A"
    });
  });
});
