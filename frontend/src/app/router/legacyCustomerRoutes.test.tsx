import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LegacyCustomerOrderRedirectRoute, LegacyCustomerOrdersRedirectRoute } from "./legacyCustomerRoutes";

describe("legacy customer routes", () => {
  it("redirige /orders a /c/pedidos", () => {
    render(
      <MemoryRouter initialEntries={["/orders"]}>
        <Routes>
          <Route path="/orders" element={<LegacyCustomerOrdersRedirectRoute />} />
          <Route path="/c/pedidos" element={<div>pedidos actuales</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("pedidos actuales")).toBeInTheDocument();
  });

  it("redirige /orders/:id a /c/pedido/:id", () => {
    render(
      <MemoryRouter initialEntries={["/orders/41"]}>
        <Routes>
          <Route path="/orders/:id" element={<LegacyCustomerOrderRedirectRoute />} />
          <Route path="/c/pedido/:id" element={<div>tracking actual</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("tracking actual")).toBeInTheDocument();
  });
});
