import type { PricingSummary } from "../../types";
import { formatCurrency } from "../../utils/format";
import { isPricingComplete } from "../../utils/pricing";

function ValueCell({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-amber-700">Pendiente backend</span>;
  }

  return <span>{formatCurrency(value)}</span>;
}

export function PricingSummaryCard({
  pricing,
  title = "Resumen"
}: {
  pricing: PricingSummary | null;
  title?: string;
}) {
  return (
    <div className="rounded-[28px] bg-white p-5 shadow-sm">
      <h3 className="text-lg font-bold">{title}</h3>
      {!isPricingComplete(pricing) ? (
        <p className="mt-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          El backend todavía no entrega el desglose completo de descuentos. La UI no los recalcula.
        </p>
      ) : null}
      <div className="mt-4 space-y-3 text-sm text-zinc-600">
        <div className="flex items-center justify-between">
          <span>Subtotal</span>
          <ValueCell value={pricing?.subtotal ?? null} />
        </div>
        <div className="flex items-center justify-between">
          <span>Descuento comercial</span>
          <ValueCell value={pricing?.commercialDiscountTotal ?? null} />
        </div>
        <div className="flex items-center justify-between">
          <span>Descuento financiero</span>
          <ValueCell value={pricing?.financialDiscountTotal ?? null} />
        </div>
        <div className="flex items-center justify-between">
          <span>Envío</span>
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
