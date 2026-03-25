import { useEffect, useState } from "react";
import { EmptyState, LoadingCard, PageHeader } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import { fetchDeliverySettlements } from "../../../shared/services/api";
import type { DeliverySettlement } from "../../../shared/types";
import { EarningsSummary } from "../components/EarningsSummary";

export function EarningsPage() {
  const { token } = useAuthSession();
  const [settlement, setSettlement] = useState<DeliverySettlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetchDeliverySettlements(token)
      .then((value) => {
        setSettlement(value);
        setError(null);
      })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "No se pudo cargar la liquidacion"))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <LoadingCard />;
  if (error || !settlement) return <EmptyState title="Ganancias no disponibles" description={error ?? "Sin liquidacion"} />;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Rider" title="Ganancias" description="Consulta tus ingresos, cobros y liquidaciones." />
      <EarningsSummary settlement={settlement} />
    </div>
  );
}
