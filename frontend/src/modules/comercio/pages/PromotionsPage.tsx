import { HelpTooltip } from "../../../shared/ui/HelpTooltip";
import { MerchantPageBar } from "../components/MerchantPageBar";
import { PromoManager } from "../components/PromoManager";

export function PromotionsPage() {
  return (
    <div className="space-y-4 md:space-y-5">
      <MerchantPageBar
        eyebrow="Comercial"
        title={
          <span className="inline-flex items-center gap-3">
            <span>Promociones</span>
            <HelpTooltip label="Ayuda sobre promociones">
              Crea combos con productos existentes, precio final y límite por cliente.
            </HelpTooltip>
          </span>
        }
      />
      <PromoManager />
    </div>
  );
}
