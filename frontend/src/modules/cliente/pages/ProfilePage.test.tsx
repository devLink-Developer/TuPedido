import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProfilePage } from "./ProfilePage";

const fetchAddressesMock = vi.fn();

vi.mock("../../../shared/hooks", () => ({
  useAuthSession: () => ({
    token: "token",
    user: {
      id: 1,
      full_name: "Cliente Demo",
      email: "cliente@example.com",
    },
  }),
}));

vi.mock("../../../shared/services/api", () => ({
  createAddress: vi.fn(),
  deleteAddress: vi.fn(),
  fetchAddresses: (...args: unknown[]) => fetchAddressesMock(...args),
  updateAddress: vi.fn(),
}));

vi.mock("../../../shared/utils/customerAddresses", () => ({
  notifyCustomerAddressesChanged: vi.fn(),
}));

vi.mock("../components/AddressFormCard", () => ({
  AddressFormCard: () => <div>Formulario de direccion</div>,
  emptyAddressForm: {
    label: "",
    postal_code: "",
    province: "",
    locality: "",
    street_name: "",
    street_number: "",
    details: "",
    latitude: "",
    longitude: "",
    is_default: false,
  },
  getAddressMissingFields: vi.fn(() => []),
  hasAddressGeolocation: vi.fn(() => true),
  toAddressFormState: vi.fn(),
  toAddressPayload: vi.fn(),
}));

describe("ProfilePage", () => {
  it("muestra el formulario de nueva direccion solo cuando el usuario lo solicita", async () => {
    fetchAddressesMock.mockResolvedValueOnce([]);
    const user = userEvent.setup();

    render(<ProfilePage />);

    await waitFor(() => expect(fetchAddressesMock).toHaveBeenCalledWith("token"));
    expect(screen.getByRole("button", { name: "Nueva direccion" })).toBeInTheDocument();
    expect(screen.queryByText("Formulario de direccion")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Nueva direccion" }));

    expect(screen.getByText("Formulario de direccion")).toBeInTheDocument();
  });
});
