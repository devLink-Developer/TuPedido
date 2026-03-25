import type { DeliverySettlement } from "../../../shared/types";
import { formatCurrency } from "../../../shared/utils/format";

export function EarningsSummary({ settlement }: { settlement: DeliverySettlement }) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <div className="mesh-surface rounded-[28px] border border-white/80 p-5 shadow-lift">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Ganado</p>
        <h3 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink">{formatCurrency(settlement.rider_fee_earned_total)}</h3>
      </div>
      <div className="mesh-surface rounded-[28px] border border-white/80 p-5 shadow-lift">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Pagado</p>
        <h3 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink">{formatCurrency(settlement.rider_fee_paid_total)}</h3>
      </div>
      <div className="mesh-surface rounded-[28px] border border-white/80 p-5 shadow-lift">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Cash</p>
        <h3 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink">{formatCurrency(settlement.cash_liability_total)}</h3>
      </div>
      <div className="mesh-surface rounded-[28px] border border-white/80 p-5 shadow-lift">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Abierto</p>
        <h3 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink">{formatCurrency(settlement.cash_liability_open)}</h3>
      </div>
    </div>
  );
}
