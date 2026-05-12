import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DeliveryProfile } from "../../../shared/types";
import { RidersPage } from "./RidersPage";

const fetchMerchantRidersMock = vi.fn();
const createMerchantRiderMock = vi.fn();
const updateMerchantRiderMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("../../../shared/hooks", () => ({
  useAuthSession: () => ({
    token: "token",
    refresh: refreshMock
  })
}));

vi.mock("../../../shared/services/api", () => ({
  createMerchantRider: (...args: unknown[]) => createMerchantRiderMock(...args),
  fetchMerchantRiders: (...args: unknown[]) => fetchMerchantRidersMock(...args),
  updateMerchantRider: (...args: unknown[]) => updateMerchantRiderMock(...args)
}));

vi.mock("../../../shared/components", () => ({
  EmptyState: ({ title, description }: { title: string; description?: string }) => (
    <div>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </div>
  ),
  ImageAssetField: ({ label }: { label: string }) => <div>{label}</div>,
  LoadingCard: ({ label }: { label?: string }) => <div>{label ?? "Cargando..."}</div>
}));

vi.mock("../../../shared/ui/Button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>
}));

const baseRider = {
  user_id: 44,
  store_id: 1,
  store_name: "Mi Local",
  full_name: "Rider Demo",
  email: "rider@test.com",
  phone: "+54 11 3333 1234",
  vehicle_type: "motorcycle",
  photo_url: null,
  dni_number: "12345678",
  emergency_contact_name: "Contacto",
  emergency_contact_phone: "+54 11 4444 5555",
  license_number: "LIC123",
  vehicle_plate: "ABC123",
  insurance_policy: null,
  notes: null,
  availability: "idle",
  is_active: true,
  current_zone_id: null,
  current_latitude: null,
  current_longitude: null,
  last_location_at: null,
  completed_deliveries: 10,
  rating: 0,
  push_enabled: false
} satisfies DeliveryProfile;

describe("RidersPage", () => {
  beforeEach(() => {
    fetchMerchantRidersMock.mockReset();
    createMerchantRiderMock.mockReset();
    updateMerchantRiderMock.mockReset();
    refreshMock.mockReset();
    fetchMerchantRidersMock.mockResolvedValue([baseRider]);
  });

  it("mantiene la pantalla enfocada en equipo y no muestra asignacion de pedidos", async () => {
    render(<RidersPage />);

    await waitFor(() => expect(screen.getByText("Repartidores")).toBeInTheDocument());

    expect(screen.getAllByRole("button", { name: /Nuevo repartidor/i })).toHaveLength(1);
    expect(screen.queryByText("Pedidos listos para repartir")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Asignar repartidor/i })).not.toBeInTheDocument();
    expect(fetchMerchantRidersMock).toHaveBeenCalledWith("token");
  });
});
