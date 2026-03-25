import { useEffect, useState } from "react";
import { EmptyState, LoadingCard, PageHeader, StatCard } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import {
  fetchAdminApplications,
  fetchAdminDeliveryApplications,
  fetchAdminOrders,
  fetchAdminStores
} from "../../../shared/services/api";

export function DashboardPage() {
  const { token } = useAuthSession();
  const [counts, setCounts] = useState({ applications: 0, stores: 0, riders: 0, orders: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      fetchAdminApplications(token),
      fetchAdminStores(token),
      fetchAdminDeliveryApplications(token),
      fetchAdminOrders(token)
    ])
      .then(([applications, stores, riders, orders]) => {
        setCounts({
          applications: applications.length,
          stores: stores.length,
          riders: riders.length,
          orders: orders.length
        });
        setError(null);
      })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "No se pudo cargar el dashboard"))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <LoadingCard />;
  if (error) return <EmptyState title="Dashboard no disponible" description={error} />;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Admin" title="Dashboard" description="Resumen central de operación, aprobaciones y volumen." />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Aplicaciones" value={String(counts.applications)} />
        <StatCard label="Comercios" value={String(counts.stores)} />
        <StatCard label="Riders" value={String(counts.riders)} />
        <StatCard label="Pedidos" value={String(counts.orders)} />
      </div>
    </div>
  );
}
