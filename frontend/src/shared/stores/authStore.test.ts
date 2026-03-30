import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "./authStore";

function createAuthResponse() {
  return {
    access_token: "token",
    token_type: "bearer",
    user: {
      id: 1,
      full_name: "Cliente Demo",
      email: "cliente@example.com",
      role: "customer" as const,
      is_active: true
    }
  };
}

function createJsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

describe("authStore order review prompt cleanup", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("clears the dismissed prompt marker on login and register", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockResolvedValueOnce(createJsonResponse(createAuthResponse()));
    window.sessionStorage.setItem("tupedido.order-review.dismissed", "41");

    await useAuthStore.getState().login("cliente@example.com", "secret123");

    expect(window.sessionStorage.getItem("tupedido.order-review.dismissed")).toBeNull();

    fetchMock.mockResolvedValueOnce(createJsonResponse(createAuthResponse()));
    window.sessionStorage.setItem("tupedido.order-review.dismissed", "42");

    await useAuthStore.getState().register("Cliente Demo", "cliente@example.com", "secret123");

    expect(window.sessionStorage.getItem("tupedido.order-review.dismissed")).toBeNull();
  });

  it("clears the dismissed prompt marker on setSession and logout", () => {
    window.sessionStorage.setItem("tupedido.order-review.dismissed", "41");

    useAuthStore.getState().setSession(createAuthResponse());

    expect(window.sessionStorage.getItem("tupedido.order-review.dismissed")).toBeNull();

    window.sessionStorage.setItem("tupedido.order-review.dismissed", "41");

    useAuthStore.getState().logout();

    expect(window.sessionStorage.getItem("tupedido.order-review.dismissed")).toBeNull();
  });
});
