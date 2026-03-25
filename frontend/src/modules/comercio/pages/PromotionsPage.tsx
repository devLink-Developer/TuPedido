import { PageHeader } from "../../../shared/components";
import { PromoManager } from "../components/PromoManager";

export function PromotionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Comercio" title="Promociones" description="Crea y administra promociones para tu comercio." />
      <PromoManager />
    </div>
  );
}
