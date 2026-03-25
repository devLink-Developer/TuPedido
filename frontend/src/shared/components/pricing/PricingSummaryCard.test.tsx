import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PricingSummaryCard } from "./PricingSummaryCard";

describe("PricingSummaryCard", () => {
  it("renders the fixed backend pricing rows without recalculating", () => {
    render(
      <PricingSummaryCard
        pricing={{
          subtotal: 10000,
          commercialDiscountTotal: -1000,
          financialDiscountTotal: -500,
          deliveryFee: 700,
          serviceFee: 300,
          total: 9500,
          complete: true
        }}
      />
    );

    expect(screen.getByText("Subtotal")).toBeInTheDocument();
    expect(screen.getByText("Descuento comercial")).toBeInTheDocument();
    expect(screen.getByText("Descuento financiero")).toBeInTheDocument();
    expect(screen.getByText(/Env/i)).toBeInTheDocument();
    expect(screen.getByText("Servicio")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
  });

  it("shows the integration pending state when pricing is incomplete", () => {
    render(
      <PricingSummaryCard
        pricing={{
          subtotal: 10000,
          commercialDiscountTotal: null,
          financialDiscountTotal: null,
          deliveryFee: 700,
          serviceFee: 300,
          total: 11000,
          complete: false
        }}
      />
    );

    expect(screen.getByText(/backend todav/i)).toBeInTheDocument();
    expect(screen.getAllByText("Pendiente backend").length).toBeGreaterThan(0);
  });
});
