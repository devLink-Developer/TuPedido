import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { useAuthStore, useCartStore, useCategoryStore, useClienteStore, useUiStore } from "../shared/stores";

if (!window.URL.createObjectURL) {
  window.URL.createObjectURL = vi.fn(() => "blob:test");
}

if (!window.URL.revokeObjectURL) {
  window.URL.revokeObjectURL = vi.fn();
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  useAuthStore.getState().resetForTest();
  useCategoryStore.getState().resetForTest();
  useUiStore.getState().resetForTest();
  useCartStore.getState().reset();
  useClienteStore.getState().resetCatalog();
  useClienteStore.getState().resetCheckout();
});

afterEach(() => {
  cleanup();
});
