import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LazyLandingRoute } from "./lazy";

describe("lazy module routes", () => {
  it("loads the landing module on demand", async () => {
    render(
      <MemoryRouter>
        <LazyLandingRoute />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Una sola PWA/i)).toBeInTheDocument();
  });
});
