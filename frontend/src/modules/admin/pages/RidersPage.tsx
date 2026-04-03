import { useEffect, useMemo, useState } from "react";
import { EmptyState, LoadingCard, PageHeader } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import {
  fetchAdminDeliveryApplications,
  fetchAdminDeliveryDispatch,
  fetchAdminDeliveryRiders
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

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      fetchAdminDeliveryApplications(token),
      fetchAdminDeliveryRiders(token),
      fetchAdminDeliveryDispatch(token)
    ])
      .then(([applicationsResult, ridersResult, dispatchResult]) => {
        setApplications(applicationsResult);
        setRiders(ridersResult);
        setDispatchOrders(dispatchResult);
        setError(null);
      })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "No se pudo cargar riders"))
      .finally(() => setLoading(false));
  }, [token]);

  const pendingApplications = useMemo(
    () => applications.filter((application) => application.status === "pending_review"),
    [applications]
  );

  if (loading) return <LoadingCard />;
  if (error) return <EmptyState title="Riders no disponibles" description={error} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Riders"
        description="Consulta solicitudes, riders visibles y pedidos pendientes de asignacion."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Solicitudes</h2>
          {pendingApplications.map((application) => (
            <article key={application.id} className="rounded-[28px] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">{application.user_name}</h3>
                  <p className="text-sm text-zinc-600">
                    {application.vehicle_type} | {application.phone}
                  </p>
                </div>
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                  {statusLabels[application.status] ?? application.status}
                </span>
              </div>
            </article>
          ))}
          {!pendingApplications.length ? (
            <EmptyState title="Sin solicitudes pendientes" description="No hay nuevas solicitudes de rider para revisar." />
          ) : null}
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-bold">Riders visibles</h2>
          {riders.map((rider) => (
            <article key={rider.user_id} className="rounded-[28px] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">{rider.full_name}</h3>
                  <p className="text-sm text-zinc-600">
                    {rider.store_name ?? "Sin comercio"} | {rider.vehicle_type}
                  </p>
                </div>
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                  {statusLabels[rider.availability] ?? rider.availability}
                </span>
              </div>
            </article>
          ))}
          {!riders.length ? <EmptyState title="Sin riders" description="Todavia no hay riders visibles." /> : null}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold">Dispatch visible</h2>
        {dispatchOrders.map((order) => (
          <article key={order.id} className="rounded-[28px] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">Pedido #{order.id}</h3>
                <p className="text-sm text-zinc-600">
                  {order.store_name} | {order.customer_name}
                </p>
              </div>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                {statusLabels[order.delivery_status] ?? order.delivery_status}
              </span>
            </div>
          </article>
        ))}
        {!dispatchOrders.length ? <EmptyState title="Sin dispatch" description="No hay pedidos esperando asignacion." /> : null}
      </div>
    </div>
  );
}
