import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../../shared/ui/Button";
import { EmptyState, LoadingCard, PageHeader, StatCard, StatusPill } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import {
  fetchMerchantOrders,
  fetchMerchantSettlementOverview,
  fetchMerchantStore
} from "../../../shared/services/api";
import type { MerchantStore, Order, SettlementOverview } from "../../../shared/types";
import { formatCurrency, formatDateTime } from "../../../shared/utils/format";
import { buildNamedPeriodStats, compareOperationalOrders } from "../../../shared/utils/orderAnalytics";
import { statusLabels } from "../../../shared/utils/labels";
import { useMerchantStoreStatusSync } from "../hooks/useMerchantStoreStatusSync";

const dashboardMessages: Record<string, { title: string; description: string }> = {
  pending_review: {
    title: "Solicitud en revision",
    description:
      "Puedes seguir ajustando catalogo, identidad y medios de cobro. El local seguira cerrado hasta la aprobacion."
  },
  approved: {
    title: "Listo para operar",
    description: "Las estadisticas del comercio ya reflejan tus pedidos. La liquidacion ahora se gestiona desde el menu Liquidaciones."
  },
  rejected: {
    title: "Alta rechazada",
    description: "Corrige la informacion del comercio y vuelve a dejarlo listo antes de una nueva revision."
  },
  suspended: {
    title: "Operacion suspendida",
    description: "El panel sigue disponible para consulta y ajustes, pero el local no recibira nuevos pedidos."
  }
};

function PeriodPanel({
  label,
  sales,
  orderCount,
  deliveredCount,
  averageTicket,
  cancellationCount
}: {
  label: string;
  sales: number;
  orderCount: number;
  deliveredCount: number;
  averageTicket: number;
  cancellationCount: number;
}) {
  return (
    <article className="rounded-[28px] bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">{label}</p>
      <p className="mt-3 font-display text-3xl font-bold tracking-tight text-ink">{formatCurrency(sales)}</p>
      <div className="mt-4 grid gap-2 text-sm text-zinc-600 sm:grid-cols-2">
        <p>Pedidos: {orderCount}</p>
        <p>Entregados: {deliveredCount}</p>
        <p>Ticket promedio: {formatCurrency(averageTicket)}</p>
        <p>Cancelados: {cancellationCount}</p>
      </div>
    </article>
  );
}

export function DashboardPage() {
  const { token } = useAuthSession();
  const [store, setStore] = useState<MerchantStore | null>(null);
  const [overview, setOverview] = useState<SettlementOverview | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const [storeResult, overviewResult, orderResult] = await Promise.all([
        fetchMerchantStore(token),
        fetchMerchantSettlementOverview(token),
        fetchMerchantOrders(token)
      ]);
      setStore(storeResult);
      setOverview(overviewResult);
      setOrders(orderResult);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo cargar el resumen");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  useMerchantStoreStatusSync({ store, setStore });

  const approvalMessage = useMemo(() => {
    if (!store) return null;
    return dashboardMessages[store.status] ?? dashboardMessages.pending_review;
  }, [store]);
  const periodStats = useMemo(() => buildNamedPeriodStats(orders), [orders]);
  const openOrders = useMemo(
    () =>
      [...orders]
        .filter((order) => !["cancelled", "delivered"].includes(order.status))
        .sort(compareOperationalOrders)
        .slice(0, 5),
    [orders]
  );
  const currentMonth = periodStats.find((item) => item.key === "month")?.stats;
  const outstandingBalance = overview?.pending_balance ?? 0;

  if (loading) return <LoadingCard />;
  if (error) return <EmptyState title="Resumen no disponible" description={error} />;
  if (!store || !overview) {
    return <EmptyState title="Comercio no disponible" description="No se pudo cargar la informacion principal del comercio." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Comercio"
        title={store.name}
        description="Primero ves estadisticas reales de ventas. La cuenta corriente de fees y los pagos a riders ahora se operan desde Liquidaciones."
        backgroundImageUrl={store.cover_image_url}
        action={
          <div className="flex flex-wrap gap-2">
            <Link to="/m/liquidaciones">
              <Button type="button" className="bg-white text-ink shadow-none">
                Ir a liquidaciones
              </Button>
            </Link>
            <Link to="/m/pedidos">
              <Button type="button" className="bg-white/10 text-white shadow-none">
                Ver pedidos
              </Button>
            </Link>
          </div>
        }
      />

      <section className="rounded-[28px] border border-[#ffe6d7] bg-[#fff8f3] p-5 text-sm text-[#6d4f43] shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#a36e58]">Ayuda</p>
        <p className="mt-2 leading-7">
          Las metricas usan los pedidos visibles del comercio y se separan en hoy, semana y mes. Si necesitas operar cobros,
          comprobantes o pagos a riders, usa el menu <strong>Liquidaciones</strong>.
        </p>
      </section>

      {approvalMessage ? (
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

      <div className="grid gap-4 xl:grid-cols-3">
        {periodStats.map((period) => (
          <PeriodPanel
            key={period.key}
            label={period.label}
            sales={period.stats.sales}
            orderCount={period.stats.orderCount}
            deliveredCount={period.stats.deliveredCount}
            averageTicket={period.stats.averageTicket}
            cancellationCount={period.stats.cancellationCount}
          />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Pedidos abiertos"
          value={String(orders.filter((order) => !["cancelled", "delivered"].includes(order.status)).length)}
          description="Carga operativa actual del comercio."
        />
        <StatCard
          label="Ventas mes"
          value={formatCurrency(currentMonth?.sales ?? 0)}
          description="Facturacion total del mes en curso."
        />
        <StatCard
          label="Fee pendiente"
          value={formatCurrency(outstandingBalance)}
          description={`${overview.pending_notices_count} avisos pendientes de revision.`}
        />
        <StatCard
          label="Fee liquidado"
          value={formatCurrency(overview.paid_balance)}
          description="Cobros ya aplicados a la cuenta corriente."
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[28px] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Operacion</p>
              <h2 className="mt-2 text-xl font-bold text-ink">Pedidos que requieren atencion</h2>
              <p className="mt-2 text-sm text-zinc-600">
                Se muestran primero los pedidos abiertos para priorizar aceptacion, preparacion y despacho.
              </p>
            </div>
            <Link to="/m/pedidos" className="text-sm font-semibold text-brand-600">
              Ver todos
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {openOrders.map((order) => (
              <article key={order.id} className="rounded-[22px] bg-zinc-50 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">Pedido #{order.id}</p>
                    <p className="mt-1 text-zinc-500">
                      {order.customer_name} | {formatDateTime(order.created_at)}
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-600">
                    {statusLabels[order.status] ?? order.status}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 text-zinc-600 md:grid-cols-3">
                  <p>Total cliente: {formatCurrency(order.total)}</p>
                  <p>Delivery: {formatCurrency(order.delivery_fee_customer)}</p>
                  <p>Pago: {statusLabels[order.payment_status] ?? order.payment_status}</p>
                </div>
              </article>
            ))}
            {!openOrders.length ? (
              <EmptyState
                title="Sin pedidos abiertos"
                description="Cuando entren nuevos pedidos o haya pedidos en curso apareceran aqui."
              />
            ) : null}
          </div>
        </section>

        <section className="space-y-4">
          <article className="rounded-[28px] bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Cuenta corriente</p>
            <h2 className="mt-2 text-xl font-bold text-ink">Resumen financiero</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] bg-[#fff6ef] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Pendiente</p>
                <p className="mt-2 text-2xl font-bold text-ink">{formatCurrency(outstandingBalance)}</p>
              </div>
              <div className="rounded-[22px] bg-[#f6fbf7] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Liquidado</p>
                <p className="mt-2 text-2xl font-bold text-ink">{formatCurrency(overview.paid_balance)}</p>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-sm text-zinc-600">
              <p>Pagos registrados: {overview.payments?.length ?? 0}</p>
              <p>Ultimo cargo: {overview.last_charge_at ? formatDateTime(overview.last_charge_at) : "Sin cargos"}</p>
              <p>Ultimo pago: {overview.last_payment_at ? formatDateTime(overview.last_payment_at) : "Sin pagos"}</p>
            </div>
            <Link to="/m/liquidaciones" className="mt-4 inline-flex text-sm font-semibold text-brand-600">
              Administrar liquidaciones
            </Link>
          </article>

          <article className="rounded-[28px] bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Proximo paso</p>
            <h2 className="mt-2 text-xl font-bold text-ink">Mantener el panel al dia</h2>
            <p className="mt-2 text-sm leading-7 text-zinc-600">
              Usa <strong>Promociones</strong> para combos, <strong>Pedidos</strong> para operar estados y{" "}
              <strong>Liquidaciones</strong> para enviar comprobantes o registrar pagos a riders sin mezclar funciones.
            </p>
          </article>
        </section>
      </div>
    </div>
  );
}
