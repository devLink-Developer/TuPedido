import { useEffect, type ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MerchantMobileHeaderProvider, useMerchantMobileHeader } from "../../modules/comercio/MerchantMobileHeaderContext";
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

function MobileHeaderActionSetter({ action }: { action: ReactNode }) {
  const { setMobileHeaderAction } = useMerchantMobileHeader();

  useEffect(() => {
    setMobileHeaderAction(action);
    return () => {
      setMobileHeaderAction(null);
    };
  }, [action, setMobileHeaderAction]);

  return null;
}

function renderLayout(initialEntry = "/m/pedidos", options?: { mobileHeaderAction?: ReactNode }) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <MerchantMobileHeaderProvider>
        <Routes>
          <Route
            path="/m/pedidos"
            element={
              <MerchantDashboardLayout>
                {options?.mobileHeaderAction ? <MobileHeaderActionSetter action={options.mobileHeaderAction} /> : null}
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
      </MerchantMobileHeaderProvider>
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
    expect(openButton.parentElement).toHaveClass("self-end", "sm:self-auto");
    expect(openButton.closest("header")).toHaveClass("flex-col", "sm:flex-row");
  });

  it("renderiza una accion mobile extra junto al menu sin romper el drawer", async () => {
    const user = userEvent.setup();

    renderLayout("/m/pedidos", {
      mobileHeaderAction: (
        <button type="button" className="rounded-full px-3 py-2">
          Recibir pedidos
        </button>
      )
    });

    const openButton = screen.getByRole("button", { name: "Abrir menu de comercio" });
    expect(screen.getByRole("button", { name: "Recibir pedidos" })).toBeInTheDocument();
    expect(openButton.closest("header")).toHaveClass("justify-between");

    await user.click(openButton);

    expect(screen.getByRole("dialog", { name: "Menu de comercio" })).toBeInTheDocument();
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
