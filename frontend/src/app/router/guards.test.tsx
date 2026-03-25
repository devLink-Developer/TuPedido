import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { useAuthStore } from "../../shared/stores";
import { GuestOnlyRoute, RequireRoles } from "./guards";

describe("router guards", () => {
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
});
