import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminLayout } from "./AdminLayout";

const logoutMock = vi.fn();

vi.mock("../../shared/hooks", async () => {
  const actual = await vi.importActual<typeof import("../../shared/hooks")>("../../shared/hooks");
  return {
    ...actual,
    useAuthSession: () => ({
      user: {
        id: 1,
        full_name: "Admin Demo",
        email: "admin@example.com",
        role: "admin",
        is_active: true
      },
      logout: logoutMock
    })
  };
});

function renderLayout(initialEntry = "/a/comercios") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/a/comercios"
          element={
            <AdminLayout>
              <div>comercios page</div>
            </AdminLayout>
          }
        />
        <Route
          path="/a/pedidos"
          element={
            <AdminLayout>
              <div>pedidos page</div>
            </AdminLayout>
          }
        />
        <Route path="/login" element={<div>login page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AdminLayout", () => {
  beforeEach(() => {
    logoutMock.mockReset();
  });

  it("usa un header mobile apilado para no comprimir el titulo", () => {
    renderLayout();

    const openButton = screen.getByRole("button", { name: "Abrir menu admin" });
    expect(openButton).toHaveClass("self-end", "sm:self-auto");
    expect(openButton.closest("header")).toHaveClass("flex-col", "sm:flex-row");
  });

  it("abre el drawer mobile y lo cierra al navegar", async () => {
    const user = userEvent.setup();

    renderLayout();

    expect(screen.queryByRole("dialog", { name: "Menu admin" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Abrir menu admin" }));

    const dialog = screen.getByRole("dialog", { name: "Menu admin" });
    expect(within(dialog).getByText("Admin Demo")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("link", { name: "Pedidos" }));

    expect(await screen.findByText("pedidos page")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Menu admin" })).not.toBeInTheDocument());
  });

  it("permite cerrar el drawer mobile con el boton dedicado", async () => {
    const user = userEvent.setup();

    renderLayout();

    await user.click(screen.getByRole("button", { name: "Abrir menu admin" }));
    const dialog = screen.getByRole("dialog", { name: "Menu admin" });

    await user.click(within(dialog).getByRole("button", { name: "Cerrar menu admin" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Menu admin" })).not.toBeInTheDocument());
  });

  it("no expone gestion de riders en la navegacion admin", async () => {
    const user = userEvent.setup();

    renderLayout();

    expect(screen.queryByRole("link", { name: "Riders" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Abrir menu admin" }));

    const dialog = screen.getByRole("dialog", { name: "Menu admin" });
    expect(within(dialog).queryByRole("link", { name: "Riders" })).not.toBeInTheDocument();
  });
});
