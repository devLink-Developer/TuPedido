import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MerchantRegistrationForm } from "./MerchantRegistrationForm";

const createMerchantApplicationMock = vi.fn();
const fetchMerchantApplicationsMock = vi.fn();
const registerMerchantApplicationMock = vi.fn();
const loadCategoriesMock = vi.fn();
const refreshMock = vi.fn();
const setSessionMock = vi.fn();

vi.mock("../../../shared/hooks", () => ({
  useAuthSession: () => ({
    token: null,
    user: null,
    isAuthenticated: false,
    refresh: refreshMock
  })
}));

vi.mock("../../../shared/services/api", () => ({
  createMerchantApplication: (...args: unknown[]) => createMerchantApplicationMock(...args),
  fetchMerchantApplications: (...args: unknown[]) => fetchMerchantApplicationsMock(...args),
  registerMerchantApplication: (...args: unknown[]) => registerMerchantApplicationMock(...args)
}));

vi.mock("../../../shared/stores", () => ({
  useAuthStore: (selector: (state: { setSession: typeof setSessionMock }) => unknown) =>
    selector({ setSession: setSessionMock }),
  useCategoryStore: (
    selector: (state: { categories: Array<Record<string, unknown>>; loading: boolean; loadCategories: typeof loadCategoriesMock }) => unknown
  ) =>
    selector({
      categories: [
        {
          id: 1,
          name: "Gastronomia",
          slug: "gastronomia",
          description: null,
          color: "#f97316",
          color_light: "#ffedd5",
          icon: null,
          is_active: true,
          sort_order: 0
        }
      ],
      loading: false,
      loadCategories: loadCategoriesMock
    })
}));

vi.mock("../../../shared/components", () => ({
  EmptyState: ({ title, description }: { title: string; description?: string }) => (
    <div>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </div>
  ),
  LoadingCard: () => <div>Cargando...</div>,
  PageHeader: ({ title, description }: { title: string; description?: string }) => (
    <div>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </div>
  ),
  RubroChip: ({ label, onClick }: { label: string; onClick: () => void }) => (
    <button type="button" onClick={onClick}>
      {label}
    </button>
  ),
  StatusPill: ({ value }: { value: string }) => <span>{value}</span>
}));

vi.mock("../../../shared/ui/Button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>
}));

function renderForm() {
  return render(
    <MemoryRouter initialEntries={["/registro-comercio"]}>
      <Routes>
        <Route path="/registro-comercio" element={<MerchantRegistrationForm />} />
        <Route path="/m/configuracion-guiada" element={<div>guia inicial</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("MerchantRegistrationForm", () => {
  beforeEach(() => {
    createMerchantApplicationMock.mockReset();
    fetchMerchantApplicationsMock.mockReset();
    registerMerchantApplicationMock.mockReset();
    loadCategoriesMock.mockReset();
    refreshMock.mockReset();
    setSessionMock.mockReset();

    loadCategoriesMock.mockResolvedValue(undefined);
    fetchMerchantApplicationsMock.mockResolvedValue([]);
    registerMerchantApplicationMock.mockResolvedValue({
      access_token: "token",
      token_type: "bearer",
      user: {
        id: 10,
        full_name: "Comercio Test",
        email: "comercio@test.com",
        role: "merchant",
        is_active: true
      }
    });
  });

  it("lleva al comercio nuevo a la guia inicial despues del registro", async () => {
    const user = userEvent.setup();

    renderForm();

    await waitFor(() => expect(screen.getByText("Completa el alta de tu negocio")).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText("Nombre del responsable"), "Ana Responsable");
    await user.type(screen.getByPlaceholderText("Email"), "ana@test.com");
    await user.type(screen.getByPlaceholderText("Contrasena"), "12345678");
    await user.type(screen.getByPlaceholderText("Nombre comercial"), "Mi Local");
    await user.type(screen.getByPlaceholderText("Telefono"), "3420000000");
    await user.type(screen.getByPlaceholderText("Direccion"), "San Martin 123");
    await user.type(screen.getByPlaceholderText("Describe tu propuesta comercial"), "Comida casera");
    await user.click(screen.getByRole("button", { name: "Gastronomia" }));
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Guardar solicitud y registrarse" }));

    await waitFor(() => expect(screen.getByText("guia inicial")).toBeInTheDocument());
    expect(setSessionMock).toHaveBeenCalled();
  });
});
