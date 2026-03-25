import { useEffect, useMemo, useState } from "react";
import { EmptyState, LoadingCard, PageHeader, StatCard, StatusPill } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import { fetchMerchantOrders, fetchMerchantSettlementOverview, fetchMerchantStore } from "../../../shared/services/api";
import type { MerchantStore, Order, SettlementOverview } from "../../../shared/types";
import { formatCurrency } from "../../../shared/utils/format";

const dashboardMessages: Record<string, { title: string; description: string }> = {
  pending_review: {
    title: "Solicitud en revision",
    description:
      "Tu panel ya esta activo para cargar productos, branding y medios de cobro. El local seguira cerrado hasta que el equipo apruebe el alta."
  },
  approved: {
    title: "Listo para operar",
    description: "Tu comercio ya puede recibir pedidos cuando actives la operacion desde configuracion."
  },
  rejected: {
    title: "Alta rechazada",
    description: "Revisa la informacion cargada y actualiza tu comercio antes de volver a solicitar aprobacion."
  },
  suspended: {
    title: "Operacion suspendida",
    description: "Puedes revisar la configuracion del negocio, pero el local no recibira nuevos pedidos hasta nueva autorizacion."
  }
};

export function DashboardPage() {
  const { token } = useAuthSession();
  const [store, setStore] = useState<MerchantStore | null>(null);
  const [overview, setOverview] = useState<SettlementOverview | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchMerchantStore(token), fetchMerchantSettlementOverview(token), fetchMerchantOrders(token)])
      .then(([storeResult, overviewResult, orderResult]) => {
        if (cancelled) return;
        setStore(storeResult);
        setOverview(overviewResult);
        setOrders(orderResult);
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "No se pudo cargar el panel");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const approvalMessage = useMemo(() => {
    if (!store) return null;
    return dashboardMessages[store.status] ?? dashboardMessages.pending_review;
  }, [store]);

  if (loading) return <LoadingCard />;
  if (error) return <EmptyState title="Error" description={error} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Comercio"
        title={store?.name ?? "Panel de comercio"}
        description="Sigue tus cobros, revisa tus pedidos y termina de preparar el local para salir a vender."
      />

      {store && approvalMessage ? (
        <section className="rounded-[28px] border border-black/5 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Estado comercial</p>
              <h2 className="mt-2 text-2xl font-bold text-ink">{approvalMessage.title}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-zinc-600">{approvalMessage.description}</p>
            </div>
            <StatusPill value={store.status} />
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Saldo pendiente"
          value={formatCurrency(overview?.pending_balance)}
          description={`${overview?.pending_charges_count ?? 0} cargos abiertos`}
        />
        <StatCard label="Pedidos" value={String(orders.length)} description="Pedidos visibles para el comercio" />
        <StatCard
          label="Operacion"
          value={store?.status === "approved" ? (store.accepting_orders ? "Abierta" : "Pausada") : "En revision"}
          description={
            store?.status === "approved"
              ? store.opening_note ?? "Panel listo para recibir pedidos cuando tu equipo lo decida."
              : "Aun no puedes abrir el local ni recibir pedidos."
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[28px] bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold">Cuenta corriente</h3>
          <div className="mt-4 space-y-2 text-sm text-zinc-600">
            <p>Comercio: {store?.name ?? "-"}</p>
            <p>Saldo pendiente: {formatCurrency(overview?.pending_balance)}</p>
            <p>Pagado: {formatCurrency(overview?.paid_balance)}</p>
            <p>Notificaciones pendientes: {overview?.pending_notices_count ?? 0}</p>
          </div>
        </div>
        <div className="rounded-[28px] bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold">Ultimos pedidos</h3>
          <div className="mt-4 space-y-3">
            {orders.slice(0, 4).map((order) => (
              <div key={order.id} className="rounded-2xl bg-zinc-50 p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span>Pedido #{order.id}</span>
                  <strong>{formatCurrency(order.pricing.total)}</strong>
                </div>
                <p className="mt-1 text-zinc-500">{order.customer_name}</p>
              </div>
            ))}
            {!orders.length ? <p className="text-sm text-zinc-500">Todavia no hay pedidos.</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
