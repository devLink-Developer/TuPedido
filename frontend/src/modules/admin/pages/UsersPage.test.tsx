import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UsersPage } from "./UsersPage";

const fetchAdminUsersMock = vi.fn();
const resetAdminCustomerPasswordMock = vi.fn();

vi.mock("../../../shared/hooks", () => ({
  useAuthSession: () => ({
    token: "token"
  })
}));

vi.mock("../../../shared/services/api", () => ({
  fetchAdminUsers: (...args: unknown[]) => fetchAdminUsersMock(...args),
  resetAdminCustomerPassword: (...args: unknown[]) => resetAdminCustomerPasswordMock(...args)
}));

vi.mock("../../../shared/components", () => ({
  EmptyState: ({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  ),
  LoadingCard: () => <div>Cargando...</div>,
  PageHeader: ({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  ),
  StatCard: ({ label, value, description }: { label: string; value: string; description?: string }) => (
    <div>
      <h2>{label}</h2>
      <p>{value}</p>
      {description ? <span>{description}</span> : null}
    </div>
  )
}));

function createUser(id: number, overrides?: Partial<Record<string, unknown>>) {
  return {
    id,
    full_name: `Usuario ${id}`,
    email: `user${id}@test.com`,
    role: "customer",
    is_active: true,
    must_change_password: false,
    ...overrides
  };
}

describe("UsersPage", () => {
  beforeEach(() => {
    fetchAdminUsersMock.mockReset();
    resetAdminCustomerPasswordMock.mockReset();
  });

  it("muestra el boton de restablecer solo para clientes", async () => {
    fetchAdminUsersMock.mockResolvedValueOnce([
      createUser(1, { role: "customer" }),
      createUser(2, { role: "merchant" })
    ]);

    render(<UsersPage />);

    const customerCard = (await screen.findByText("Usuario 1")).closest("article");
    const merchantCard = (await screen.findByText("Usuario 2")).closest("article");
    if (!customerCard || !merchantCard) {
      throw new Error("No se encontraron las tarjetas esperadas");
    }

    expect(within(customerCard).getByRole("button", { name: "Restablecer contrasena" })).toBeInTheDocument();
    expect(within(merchantCard).queryByRole("button", { name: "Restablecer contrasena" })).not.toBeInTheDocument();
  });

  it("restablece la contrasena del cliente y actualiza la card al instante", async () => {
    const user = userEvent.setup();
    fetchAdminUsersMock.mockResolvedValueOnce([createUser(7)]);
    resetAdminCustomerPasswordMock.mockResolvedValueOnce({ temporary_password: "12345678" });

    render(<UsersPage />);

    const customerCard = (await screen.findByText("Usuario 7")).closest("article");
    if (!customerCard) {
      throw new Error("No se encontro la tarjeta del cliente");
    }

    await user.click(within(customerCard).getByRole("button", { name: "Restablecer contrasena" }));

    await waitFor(() => expect(resetAdminCustomerPasswordMock).toHaveBeenCalledWith("token", 7));
    expect(within(customerCard).getByText("Cambio requerido")).toBeInTheDocument();
    expect(
      screen.getByText(/Contrasena de Usuario 7 restablecida a 12345678\. El cliente debera cambiarla al ingresar\./i)
    ).toBeInTheDocument();
  });
});
