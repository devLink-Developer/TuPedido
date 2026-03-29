import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { useAuthStore } from "../../shared/stores";
import { GuestOnlyRoute, PasswordChangeRoute, RequireRoles } from "./guards";

function LocationProbe() {
  const location = useLocation();

  return <div>{`${location.pathname}${location.search}`}</div>;
}

describe("router guards", () => {
  beforeEach(() => {
    useAuthStore.getState().resetForTest();
  });

  it("redirects unauthenticated users to /login from protected routes", () => {
    render(
      <MemoryRouter initialEntries={["/a"]}>
        <Routes>
          <Route path="/login" element={<div>login route</div>} />
          <Route element={<RequireRoles roles={["admin"]} />}>
            <Route path="/a" element={<div>admin route</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("login route")).toBeInTheDocument();
  });

  it("redirects authenticated users away from guest-only routes", () => {
    useAuthStore.getState().setSession({
      access_token: "token",
      token_type: "bearer",
      user: {
        id: 1,
        full_name: "Admin User",
        email: "admin@test.com",
        role: "admin",
        is_active: true
      }
    });

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route
            path="/login"
            element={
              <GuestOnlyRoute>
                <div>guest route</div>
              </GuestOnlyRoute>
            }
          />
          <Route path="/a" element={<div>admin home</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("admin home")).toBeInTheDocument();
  });

  it("redirects flagged users from guest-only routes to forced password change", () => {
    useAuthStore.getState().setSession({
      access_token: "token",
      token_type: "bearer",
      user: {
        id: 12,
        full_name: "Cliente Reset",
        email: "cliente@test.com",
        role: "customer",
        is_active: true,
        must_change_password: true
      }
    });

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route
            path="/login"
            element={
              <GuestOnlyRoute>
                <div>guest route</div>
              </GuestOnlyRoute>
            }
          />
          <Route path="/cambiar-contrasena" element={<div>forced password change</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("forced password change")).toBeInTheDocument();
  });

  it("redirects authenticated users to their own home when the role does not match", () => {
    useAuthStore.getState().setSession({
      access_token: "token",
      token_type: "bearer",
      user: {
        id: 2,
        full_name: "Merchant User",
        email: "merchant@test.com",
        role: "merchant",
        is_active: true
      }
    });

    render(
      <MemoryRouter initialEntries={["/a"]}>
        <Routes>
          <Route path="/m" element={<div>merchant home</div>} />
          <Route element={<RequireRoles roles={["admin"]} />}>
            <Route path="/a" element={<div>admin route</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("merchant home")).toBeInTheDocument();
  });

  it("preserves redirectTo when protecting legacy customer routes", () => {
    render(
      <MemoryRouter initialEntries={["/orders/99"]}>
        <Routes>
          <Route path="/login" element={<LocationProbe />} />
          <Route element={<RequireRoles roles={["customer"]} />}>
            <Route path="/orders/:id" element={<div>legacy customer route</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("/login?redirectTo=%2Forders%2F99")).toBeInTheDocument();
  });

  it("redirects flagged users from protected routes to password change preserving redirectTo", () => {
    useAuthStore.getState().setSession({
      access_token: "token",
      token_type: "bearer",
      user: {
        id: 13,
        full_name: "Cliente Reset",
        email: "cliente@test.com",
        role: "customer",
        is_active: true,
        must_change_password: true
      }
    });

    render(
      <MemoryRouter initialEntries={["/c/pedidos"]}>
        <Routes>
          <Route path="/cambiar-contrasena" element={<LocationProbe />} />
          <Route element={<RequireRoles roles={["customer"]} />}>
            <Route path="/c/pedidos" element={<div>orders route</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("/cambiar-contrasena?redirectTo=%2Fc%2Fpedidos")).toBeInTheDocument();
  });

  it("redirects users without pending password change away from the forced route", () => {
    useAuthStore.getState().setSession({
      access_token: "token",
      token_type: "bearer",
      user: {
        id: 14,
        full_name: "Cliente Activo",
        email: "cliente2@test.com",
        role: "customer",
        is_active: true,
        must_change_password: false
      }
    });

    render(
      <MemoryRouter initialEntries={["/cambiar-contrasena?redirectTo=/c/pedidos"]}>
        <Routes>
          <Route
            path="/cambiar-contrasena"
            element={
              <PasswordChangeRoute>
                <div>forced password change</div>
              </PasswordChangeRoute>
            }
          />
          <Route path="/c/pedidos" element={<div>orders home</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("orders home")).toBeInTheDocument();
  });
});
