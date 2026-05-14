import { describe, expect, it } from "vitest";
import { normalizeRiderInstructionText, routeProfileForVehicle } from "./deliveryRoute";

describe("normalizeRiderInstructionText", () => {
  it("uses neutral movement copy for rider instructions", () => {
    expect(normalizeRiderInstructionText("Camina 80 metros y sigue caminando por San Martin")).toBe(
      "Avanza 80 metros y sigue avanzando por San Martin"
    );
    expect(normalizeRiderInstructionText("Gira a la derecha y caminar hasta el destino")).toBe(
      "Gira a la derecha y avanzar hasta el destino"
    );
  });
});

describe("routeProfileForVehicle", () => {
  it("uses cycling routes for bicycles and driving routes for motor vehicles", () => {
    expect(routeProfileForVehicle("bicycle")).toBe("cycling-regular");
    expect(routeProfileForVehicle("motorcycle")).toBe("driving-car");
  });
});
