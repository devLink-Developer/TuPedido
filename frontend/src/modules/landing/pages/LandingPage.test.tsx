import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LandingLayout } from "../../../app/layouts/LandingLayout";
import { LandingPage } from "./LandingPage";

describe("LandingPage", () => {
  it("expone la solicitud de registro para comercios", () => {
    render(
      <MemoryRouter>
        <LandingLayout>
          <LandingPage />
        </LandingLayout>
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: /Solicita el alta de tu comercio/i })).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("link", { name: /Registrar comercio/i })
        .some((link) => link.getAttribute("href") === "/registro-comercio")
    ).toBe(true);
  });
});
