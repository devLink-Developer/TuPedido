import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCategoryStore } from "./categoryStore";

describe("categoryStore", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify([
            {
              id: 1,
              name: "Farmacia",
              slug: "farmacia",
              description: "Salud",
              color: "#66BB6A",
              color_light: "#E8F5E9",
              icon: "FX",
              is_active: true,
              sort_order: 1
            }
          ]),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        )
      )
    );
    useCategoryStore.getState().resetForTest();
  });

  it("loads categories once and caches the result", async () => {
    const first = await useCategoryStore.getState().loadCategories();
    const second = await useCategoryStore.getState().loadCategories();

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(useCategoryStore.getState().loaded).toBe(true);
    expect(useCategoryStore.getState().categories[0]?.color).toBe("#66BB6A");
  });

  it("lets admin updates replace the cached category list", () => {
    useCategoryStore.getState().setCategories([
      {
        id: 2,
        name: "Despensa",
        slug: "despensa",
        description: "Diario",
        color: "#FF7043",
        color_light: "#FBE9E7",
        icon: "DS",
        is_active: true,
        sort_order: 1
      }
    ]);

    expect(useCategoryStore.getState().categories[0]?.name).toBe("Despensa");
    expect(useCategoryStore.getState().loaded).toBe(true);
  });
});
