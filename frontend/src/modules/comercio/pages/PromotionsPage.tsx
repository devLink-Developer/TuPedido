import { PageHeader } from "../../../shared/components";
import { PromoManager } from "../components/PromoManager";

export function PromotionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Comercio" title="Promociones" description="Ruta visible pero bloqueada por dependencia explícita de backend." />
      <PromoManager />
    </div>
  );
}
