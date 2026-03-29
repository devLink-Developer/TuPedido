import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { StoreAddressSection, type StoreAddressFormState } from "./StoreAddressSection";

const geocodeAddressMock = vi.fn();
const reverseGeocodeAddressMock = vi.fn();

vi.mock("../../../shared/services/api", () => ({
  geocodeAddress: (...args: unknown[]) => geocodeAddressMock(...args),
  reverseGeocodeAddress: (...args: unknown[]) => reverseGeocodeAddressMock(...args),
  lookupPostalCode: vi.fn(),
}));

vi.mock("../../../shared/components/maps/AddressLocationPicker", () => ({
  AddressLocationPicker: ({
    onChange,
  }: {
    onChange: (coordinates: { latitude: number; longitude: number }, source: "map" | "current_location") => void;
  }) => (
    <button type="button" onClick={() => onChange({ latitude: -31.6333, longitude: -60.7000 }, "map")}>
      Seleccionar punto
    </button>
  ),
}));

function renderStoreAddressSection(initialForm: StoreAddressFormState) {
  function Wrapper() {
    const [form, setForm] = useState(initialForm);

    return (
      <>
        <StoreAddressSection token="token" form={form} onChange={setForm} />
        <button type="button">Fuera</button>
      </>
    );
  }

  return render(<Wrapper />);
}

describe("StoreAddressSection", () => {
  beforeEach(() => {
    geocodeAddressMock.mockReset();
    reverseGeocodeAddressMock.mockReset();
    geocodeAddressMock.mockResolvedValue({
      latitude: -31.6100,
      longitude: -60.6900,
      display_name: "San Martin 123, Santa Fe",
    });
    reverseGeocodeAddressMock.mockResolvedValue({
      street_name: "San Martin",
      street_number: "123",
      display_name: "San Martin 123, Santa Fe",
    });
  });

  it("geocodifica al desenfocar altura aunque ya haya un pin manual", async () => {
    const user = userEvent.setup();

    renderStoreAddressSection({
      postal_code: "3000",
      province: "Santa Fe",
      locality: "Santa Fe",
      street_name: "San Martin",
      street_number: "123",
      latitude: "",
      longitude: "",
    });

    fireEvent.click(screen.getByRole("button", { name: "Seleccionar punto" }));

    const streetNumberInput = screen.getByPlaceholderText("Altura");
    await user.click(streetNumberInput);
    await user.click(screen.getByRole("button", { name: "Fuera" }));

    expect(geocodeAddressMock).toHaveBeenCalledTimes(1);
    expect(geocodeAddressMock).toHaveBeenCalledWith(
      "token",
      expect.objectContaining({
        postal_code: "3000",
        province: "Santa Fe",
        locality: "Santa Fe",
        street_name: "San Martin",
        street_number: "123",
      })
    );
  });

  it("completa calle y altura al tomar el pin desde el mapa", async () => {
    renderStoreAddressSection({
      postal_code: "3000",
      province: "Santa Fe",
      locality: "Santa Fe",
      street_name: "",
      street_number: "",
      latitude: "",
      longitude: "",
    });

    fireEvent.click(screen.getByRole("button", { name: "Seleccionar punto" }));

    expect(reverseGeocodeAddressMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByPlaceholderText("Calle")).toHaveValue("San Martin"));
    await waitFor(() => expect(screen.getByPlaceholderText("Altura")).toHaveValue("123"));
  });
});
