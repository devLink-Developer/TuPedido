import type { PricingSummary } from "../../types";
import { formatCurrency } from "../../utils/format";
import { isPricingComplete } from "../../utils/pricing";

function ValueCell({ value, discount = false }: { value: number | null; discount?: boolean }) {
  if (value === null) {
    return <span className="text-amber-700">Pendiente de confirmacion</span>;
  }

  if (discount) {
    return <span>{value > 0 ? `-${formatCurrency(value)}` : formatCurrency(value)}</span>;
  }

  return <span>{formatCurrency(value)}</span>;
}

function hasDiscount(value: number | null) {
  return value !== null && value !== 0;
}

export function PricingSummaryCard({
  pricing,
  title = "Resumen",
  discountMode = "separate"
}: {
  pricing: PricingSummary | null;
  title?: string;
  discountMode?: "separate" | "combined";
}) {
  const commercialDiscount = pricing?.commercialDiscountTotal ?? null;
  const financialDiscount = pricing?.financialDiscountTotal ?? null;
  const combinedDiscount =
    commercialDiscount === null && financialDiscount === null ? null : (commercialDiscount ?? 0) + (financialDiscount ?? 0);
  const showCombinedDiscount = discountMode === "combined" && hasDiscount(combinedDiscount);

  return (
    <div className="rounded-[28px] bg-white p-5 shadow-sm">
      <h3 className="text-lg font-bold">{title}</h3>
      {!isPricingComplete(pricing) ? (
        <p className="mt-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Algunos importes se estan actualizando. El total final se confirmara antes de finalizar el pedido.
        </p>
      ) : null}
      <div className="mt-4 space-y-3 text-sm text-zinc-600">
        <div className="flex items-center justify-between">
          <span>Subtotal</span>
          <ValueCell value={pricing?.subtotal ?? null} />
        </div>
        {discountMode === "combined" ? (
          showCombinedDiscount ? (
            <div className="flex items-center justify-between">
              <span>Descuentos</span>
              <ValueCell value={combinedDiscount} discount />
            </div>
          ) : null
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span>Descuento comercial</span>
              <ValueCell value={commercialDiscount} discount />
            </div>
            <div className="flex items-center justify-between">
              <span>Descuento financiero</span>
              <ValueCell value={financialDiscount} discount />
            </div>
          </>
        )}
        <div className="flex items-center justify-between">
          <span>Envio</span>
          <ValueCell value={pricing?.deliveryFee ?? null} />
        </div>
        <div className="flex items-center justify-between">
          <span>Servicio</span>
          <ValueCell value={pricing?.serviceFee ?? null} />
        </div>
        <div className="flex items-center justify-between border-t border-black/5 pt-3 text-base font-bold text-ink">
          <span>Total</span>
          <ValueCell value={pricing?.total ?? null} />
        </div>
      </div>
    </div>
  );
}
