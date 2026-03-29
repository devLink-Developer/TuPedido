import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RiderLayout } from "./RiderLayout";

const logoutMock = vi.fn();

vi.mock("../../shared/hooks", () => ({
  useAuthSession: () => ({
    user: {
      id: 3,
      full_name: "Rider Demo",
      email: "rider@example.com",
      role: "delivery",
      is_active: true
    },
    logout: logoutMock
  })
}));

function renderLayout(initialEntry = "/r") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/r"
          element={
            <RiderLayout>
              <div>rider page</div>
            </RiderLayout>
          }
        />
        <Route path="/login" element={<div>login page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("RiderLayout", () => {
  beforeEach(() => {
    logoutMock.mockReset();
  });

  it("mantiene el titulo separado de las acciones en mobile", () => {
    renderLayout();

    const logoutButton = screen.getByRole("button", { name: "Cerrar sesion" });
    expect(logoutButton).toHaveClass("w-full", "sm:w-auto");
    expect(screen.getByRole("heading", { name: "Operacion en ruta" })).toHaveClass("text-[1.85rem]", "sm:text-3xl");
  });

  it("permite cerrar sesion desde el header", async () => {
    const user = userEvent.setup();

    renderLayout();

    await user.click(screen.getByRole("button", { name: "Cerrar sesion" }));

    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("login page")).toBeInTheDocument();
  });
});
