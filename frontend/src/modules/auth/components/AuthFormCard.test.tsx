import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "../../../shared/stores";
import { AuthFormCard } from "./AuthFormCard";

vi.mock("../../../shared/providers/PlatformBrandingProvider", () => ({
  usePlatformBranding: () => ({
    brandName: "Kepedimos",
    wordmarkUrl: null
  })
}));

describe("AuthFormCard", () => {
  beforeEach(() => {
    useAuthStore.getState().resetForTest();
  });

  it("mueve la accion secundaria al final del formulario", () => {
    useAuthStore.setState({
      loading: false,
      hydrated: true
    });

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<AuthFormCard mode="login" />} />
        </Routes>
      </MemoryRouter>
    );

    const secondaryAction = screen.getByRole("link", { name: "Crear cuenta" });
    const primaryAction = screen.getByRole("button", { name: "Ingresar" });
    expect(screen.getByText("No tienes cuenta?")).toBeInTheDocument();
    expect(secondaryAction).toHaveClass("inline-flex");
    expect(secondaryAction).not.toHaveClass("rounded-full");
    expect(primaryAction.compareDocumentPosition(secondaryAction)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getByRole("heading", { name: "Iniciar sesion" })).toBeInTheDocument();
    expect(screen.getByText("Entra para ver tus pedidos y comprar sin vueltas.")).toBeInTheDocument();
  });

  it("redirects to the role home returned by backend login", async () => {
    const user = userEvent.setup();
    const loginMock = vi.fn().mockResolvedValue({
      id: 10,
      full_name: "Merchant User",
      email: "merchant@test.com",
      role: "merchant" as const,
      is_active: true
    });

    useAuthStore.setState({
      login: loginMock,
      loading: false,
      hydrated: true
    });

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<AuthFormCard mode="login" />} />
          <Route path="/m" element={<div>merchant dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/email/i), "merchant@test.com");
    await user.type(screen.getByLabelText(/contrase/i), "secret123");
    await user.click(screen.getByRole("button", { name: "Ingresar" }));

    await waitFor(() => {
      expect(screen.getByText("merchant dashboard")).toBeInTheDocument();
    });
    expect(loginMock).toHaveBeenCalledWith("merchant@test.com", "secret123");
  });

  it("redirects to forced password change when backend marks the session", async () => {
    const user = userEvent.setup();
    const loginMock = vi.fn().mockResolvedValue({
      id: 11,
      full_name: "Cliente Reset",
      email: "cliente@test.com",
      role: "customer" as const,
      is_active: true,
      must_change_password: true
    });

    useAuthStore.setState({
      login: loginMock,
      loading: false,
      hydrated: true
    });

    render(
      <MemoryRouter initialEntries={["/login?redirectTo=/c/pedidos"]}>
        <Routes>
          <Route path="/login" element={<AuthFormCard mode="login" />} />
          <Route path="/cambiar-contrasena" element={<div>password change route</div>} />
        </Routes>
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/email/i), "cliente@test.com");
    await user.type(screen.getByLabelText(/contrase/i), "12345678");
    await user.click(screen.getByRole("button", { name: "Ingresar" }));

    await waitFor(() => {
      expect(screen.getByText("password change route")).toBeInTheDocument();
    });
    expect(loginMock).toHaveBeenCalledWith("cliente@test.com", "12345678");
  });
});
