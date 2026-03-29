import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MerchantDashboardLayout } from "./MerchantDashboardLayout";

const logoutMock = vi.fn();

vi.mock("../../shared/hooks", async () => {
  const actual = await vi.importActual<typeof import("../../shared/hooks")>("../../shared/hooks");
  return {
    ...actual,
    useAuthSession: () => ({
      user: {
        id: 8,
        full_name: "Comercio Demo",
        email: "merchant@example.com",
        role: "merchant",
        is_active: true
      },
      logout: logoutMock
    })
  };
});

function renderLayout(initialEntry = "/m/pedidos") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/m/pedidos"
          element={
            <MerchantDashboardLayout>
              <div>pedidos page</div>
            </MerchantDashboardLayout>
          }
        />
        <Route
          path="/m/configuracion"
          element={
            <MerchantDashboardLayout>
              <div>configuracion page</div>
            </MerchantDashboardLayout>
          }
        />
        <Route path="/login" element={<div>login page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("MerchantDashboardLayout", () => {
  beforeEach(() => {
    logoutMock.mockReset();
  });

  it("usa un header mobile apilado para no comprimir el titulo", () => {
    renderLayout();

    const openButton = screen.getByRole("button", { name: "Abrir menu de comercio" });
    expect(openButton).toHaveClass("self-end", "sm:self-auto");
    expect(openButton.closest("header")).toHaveClass("flex-col", "sm:flex-row");
  });

  it("abre el drawer mobile y lo cierra al navegar", async () => {
    const user = userEvent.setup();

    renderLayout();

    expect(screen.queryByRole("dialog", { name: "Menu de comercio" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Abrir menu de comercio" }));

    const dialog = screen.getByRole("dialog", { name: "Menu de comercio" });
    expect(within(dialog).getByText("Comercio Demo")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("link", { name: "Configuracion" }));

    expect(await screen.findByText("configuracion page")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Menu de comercio" })).not.toBeInTheDocument());
  });

  it("expone cerrar sesion dentro del drawer mobile", async () => {
    const user = userEvent.setup();

    renderLayout();

    await user.click(screen.getByRole("button", { name: "Abrir menu de comercio" }));
    const dialog = screen.getByRole("dialog", { name: "Menu de comercio" });

    await user.click(within(dialog).getByRole("button", { name: "Cerrar sesion" }));

    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("login page")).toBeInTheDocument();
  });
});
