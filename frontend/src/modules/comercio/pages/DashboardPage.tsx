import { useEffect, useState } from "react";
import { EmptyState, LoadingCard, PageHeader, StatCard } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import { fetchMerchantOrders, fetchMerchantSettlementOverview, fetchMerchantStore } from "../../../shared/services/api";
import type { MerchantStore, Order, SettlementOverview } from "../../../shared/types";
import { formatCurrency } from "../../../shared/utils/format";

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

  if (loading) return <LoadingCard />;
  if (error) return <EmptyState title="Error" description={error} />;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Comercio" title={store?.name ?? "Panel de comercio"} description="Resumen operativo y financiero del dominio /m." />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Saldo pendiente" value={formatCurrency(overview?.pending_balance)} description={`${overview?.pending_charges_count ?? 0} cargos abiertos`} />
        <StatCard label="Pedidos" value={String(orders.length)} description="Pedidos visibles para el comercio" />
        <StatCard label="Comercio" value={store?.accepting_orders ? "Activo" : "Pausado"} description={store?.opening_note ?? "Sin nota operativa"} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[28px] bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold">Cuenta corriente</h3>
          <div className="mt-4 space-y-2 text-sm text-zinc-600">
            <p>Comercio: {store?.name ?? "-"}</p>
            <p>Saldo pendiente: {formatCurrency(overview?.pending_balance)}</p>
            <p>Pagado: {formatCurrency(overview?.paid_balance)}</p>
            <p>Notices pendientes: {overview?.pending_notices_count ?? 0}</p>
          </div>
        </div>
        <div className="rounded-[28px] bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold">Últimos pedidos</h3>
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
            {!orders.length ? <p className="text-sm text-zinc-500">Todavía no hay pedidos.</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
