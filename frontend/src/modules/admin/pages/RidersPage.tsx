import { useEffect, useState } from "react";
import { EmptyState, LoadingCard, PageHeader } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import {
  assignAdminDeliveryOrder,
  fetchAdminDeliveryApplications,
  fetchAdminDeliveryDispatch,
  fetchAdminDeliveryRiders,
  reviewAdminDeliveryApplication
} from "../../../shared/services/api";
import type { DeliveryApplication, DeliveryProfile, Order } from "../../../shared/types";
import { statusLabels } from "../../../shared/utils/labels";

export function RidersPage() {
  const { token } = useAuthSession();
  const [applications, setApplications] = useState<DeliveryApplication[]>([]);
  const [riders, setRiders] = useState<DeliveryProfile[]>([]);
  const [dispatchOrders, setDispatchOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const [applicationsResult, ridersResult, dispatchResult] = await Promise.all([
        fetchAdminDeliveryApplications(token),
        fetchAdminDeliveryRiders(token),
        fetchAdminDeliveryDispatch(token)
      ]);
      setApplications(applicationsResult);
      setRiders(ridersResult);
      setDispatchOrders(dispatchResult);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo cargar riders");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  if (loading) return <LoadingCard />;
  if (error) return <EmptyState title="Riders no disponibles" description={error} />;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Admin" title="Riders" description="Solicitudes, riders activos y dispatch del dominio /a/riders." />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          {applications.map((application) => (
            <article key={application.id} className="rounded-[28px] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">{application.user_name}</h3>
                  <p className="text-sm text-zinc-600">{application.vehicle_type} · {application.phone}</p>
                </div>
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">{statusLabels[application.status] ?? application.status}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["approved", "rejected", "suspended"] as const).map((status) => (
                  <button key={status} type="button" onClick={async () => { if (!token) return; await reviewAdminDeliveryApplication(token, application.id, { status }); await load(); }} className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white">
                    {statusLabels[status] ?? status}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>

        <div className="space-y-4">
          {riders.map((rider) => (
            <article key={rider.user_id} className="rounded-[28px] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">{rider.full_name}</h3>
                  <p className="text-sm text-zinc-600">{rider.vehicle_type} · {rider.phone}</p>
                </div>
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">{statusLabels[rider.availability] ?? rider.availability}</span>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {dispatchOrders.map((order) => (
          <article key={order.id} className="rounded-[28px] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">Pedido #{order.id}</h3>
                <p className="text-sm text-zinc-600">{order.store_name} · {order.customer_name}</p>
              </div>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">{statusLabels[order.delivery_status] ?? order.delivery_status}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {riders.map((rider) => (
                <button key={rider.user_id} type="button" onClick={async () => { if (!token) return; await assignAdminDeliveryOrder(token, order.id, rider.user_id); await load(); }} className="rounded-full bg-brand-500 px-3 py-2 text-xs font-semibold text-white">
                  {rider.full_name}
                </button>
              ))}
            </div>
          </article>
        ))}
        {!dispatchOrders.length ? <EmptyState title="Sin dispatch" description="No hay pedidos esperando asignación." /> : null}
      </div>
    </div>
  );
}
