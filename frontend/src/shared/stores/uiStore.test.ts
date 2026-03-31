import { describe, expect, it } from "vitest";
import { useUiStore } from "./uiStore";

describe("uiStore application drafts", () => {
  it("persists and clears merchant onboarding drafts in sessionStorage", () => {
    useUiStore.getState().saveApplicationDraft(
      "merchant",
      { business_name: "Cafe Modular" },
      "/registro-comercio",
      true
    );

    expect(useUiStore.getState().getApplicationDraft("merchant")).toEqual({
      draft: { business_name: "Cafe Modular" },
      redirectTo: "/registro-comercio",
      pendingSubmit: true
    });
    expect(window.sessionStorage.getItem("kepedimos.application-draft.merchant")).toContain("Cafe Modular");

    useUiStore.getState().clearApplicationDraft("merchant");

    expect(useUiStore.getState().getApplicationDraft("merchant")).toBeNull();
    expect(window.sessionStorage.getItem("kepedimos.application-draft.merchant")).toBeNull();
  });

  it("keeps auth and cliente stores isolated from UI draft state", () => {
    useUiStore.getState().saveApplicationDraft("delivery", { phone: "123" }, "/registro-rider", true);

    expect(useUiStore.getState().getApplicationDraft("delivery")?.draft).toEqual({ phone: "123" });
    expect(useUiStore.getState().cartDrawerOpen).toBe(false);
  });
});
