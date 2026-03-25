import { useEffect, useState } from "react";
import { EmptyState, LoadingCard, PageHeader } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import {
  fetchAdminApplications,
  fetchAdminStores,
  reviewMerchantApplication,
  updateAdminStoreStatus
} from "../../../shared/services/api";
import type { MerchantApplication, StoreSummary } from "../../../shared/types";
import { statusLabels } from "../../../shared/utils/labels";

export function StoresPage() {
  const { token } = useAuthSession();
  const [applications, setApplications] = useState<MerchantApplication[]>([]);
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const [applicationsResult, storesResult] = await Promise.all([
        fetchAdminApplications(token),
        fetchAdminStores(token)
      ]);
      setApplications(applicationsResult);
      setStores(storesResult);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo cargar comercios");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  if (loading) return <LoadingCard />;
  if (error) return <EmptyState title="Comercios no disponibles" description={error} />;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Admin" title="Comercios" description="Solicitudes y comercios activos del dominio /a/comercios." />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          {applications.map((application) => (
            <article key={application.id} className="rounded-[28px] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">{application.business_name}</h3>
                  <p className="text-sm text-zinc-600">{application.address}</p>
                </div>
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">{statusLabels[application.status] ?? application.status}</span>
              </div>
              <p className="mt-3 text-sm text-zinc-600">{application.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["approved", "rejected", "suspended"] as const).map((status) => (
                  <button key={status} type="button" onClick={async () => { if (!token) return; await reviewMerchantApplication(token, application.id, { status }); await load(); }} className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white">
                    {statusLabels[status] ?? status}
                  </button>
                ))}
              </div>
            </article>
          ))}
          {!applications.length ? <EmptyState title="Sin aplicaciones" description="Todavía no hay solicitudes de comercio." /> : null}
        </div>

        <div className="space-y-4">
          {stores.map((store) => (
            <article key={store.id} className="rounded-[28px] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">{store.name}</h3>
                  <p className="text-sm text-zinc-600">{store.address}</p>
                </div>
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">{statusLabels[store.status] ?? store.status}</span>
              </div>
              <p className="mt-3 text-sm text-zinc-600">{store.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["approved", "rejected", "suspended"] as const).map((status) => (
                  <button key={status} type="button" onClick={async () => { if (!token) return; await updateAdminStoreStatus(token, store.id, { status }); await load(); }} className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white">
                    {statusLabels[status] ?? status}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
