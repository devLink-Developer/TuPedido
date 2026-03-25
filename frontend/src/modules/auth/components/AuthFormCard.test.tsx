import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { useAuthStore } from "../../../shared/stores";
import { AuthFormCard } from "./AuthFormCard";

describe("AuthFormCard", () => {
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
});
