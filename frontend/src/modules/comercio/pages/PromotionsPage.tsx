import { useState } from "react";
import { HelpTooltip } from "../../../shared/ui/HelpTooltip";
import { MerchantPageBar } from "../components/MerchantPageBar";
import { PromoManager, type PromoManagerSummary } from "../components/PromoManager";

export function PromotionsPage() {
  const [summary, setSummary] = useState<PromoManagerSummary>({
    total: 0,
    active: 0,
    paused: 0,
    products: 0,
    categories: 0
  });

  return (
    <div className="space-y-2.5">
      <MerchantPageBar
        eyebrow="Comercial"
        title={
          <span className="inline-flex items-center gap-3">
            <span>Promociones</span>
            <HelpTooltip label="Ayuda sobre promociones">
              Crea combos por categoria, define productos incluidos, precio final y limite por cliente.
            </HelpTooltip>
          </span>
        }
        stats={[
          { label: "Promos", value: summary.total },
          { label: "Activas", value: summary.active, tone: summary.active ? "success" : "neutral" },
          { label: "Categorias", value: summary.categories }
        ]}
      />
      <PromoManager onSummaryChange={setSummary} />
    </div>
  );
}
