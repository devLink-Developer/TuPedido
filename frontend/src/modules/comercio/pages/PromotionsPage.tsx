import { PageHeader } from "../../../shared/components";
import { HelpTooltip } from "../../../shared/ui/HelpTooltip";
import { PromoManager } from "../components/PromoManager";

export function PromotionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Comercial"
        title={
          <span className="inline-flex items-center gap-3">
            <span>Promociones</span>
            <HelpTooltip label="Ayuda sobre promociones" variant="inverse">
              Crea combos con productos existentes, precio final y límite por cliente.
            </HelpTooltip>
          </span>
        }
      />
      <PromoManager />
    </div>
  );
}
