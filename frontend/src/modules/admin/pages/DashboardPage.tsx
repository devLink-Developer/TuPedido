import { useEffect, useMemo, useRef, useState } from "react";
import { EmptyState, LoadingCard, PageHeader, StatCard } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import {
  fetchAdminApplications,
  fetchAdminDeliveryApplications,
  fetchAdminDeliveryRiders,
  fetchAdminOrders,
  fetchAdminStores
} from "../../../shared/services/api";
import type { DeliveryApplication, DeliveryProfile, MerchantApplication, Order, StoreSummary } from "../../../shared/types";
import { HelpTooltip } from "../../../shared/ui/HelpTooltip";
import { formatCurrency } from "../../../shared/utils/format";
import { buildNamedPeriodStats } from "../../../shared/utils/orderAnalytics";

const LIVE_REFRESH_INTERVAL_MS = 15000;
const resolvedMerchantStatuses = new Set(["approved", "rejected", "suspended"]);

type DashboardData = {
  merchantApplications: MerchantApplication[];
  riderApplications: DeliveryApplication[];
  riders: DeliveryProfile[];
  stores: StoreSummary[];
  orders: Order[];
};

const emptyDashboardData: DashboardData = {
  merchantApplications: [],
  riderApplications: [],
  riders: [],
  stores: [],
  orders: []
};

function buildStoreStats(orders: Order[]) {
  const sales = orders.reduce((sum, order) => sum + order.total, 0);
  const delivered = orders.filter((order) => order.status === "delivered").length;
  const cancelled = orders.filter((order) => order.status === "cancelled").length;
  return {
    orderCount: orders.length,
    delivered,
    cancelled,
    sales,
    averageTicket: orders.length ? sales / orders.length : 0
  };
}

function dateRangeFilter(orders: Order[], start: Date, end: Date) {
  return orders.filter((order) => {
    const createdAt = new Date(order.created_at);
    return createdAt >= start && createdAt < end;
  });
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfWeek(date: Date) {
  const next = startOfDay(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  return next;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function DashboardPage() {
  const { token } = useAuthSession();
  const [data, setData] = useState<DashboardData>(emptyDashboardData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  async function load(options?: { silent?: boolean }) {
    if (!token) return;
    const requestId = ++requestIdRef.current;
    if (!options?.silent) {
      setLoading(true);
    }
    try {
      const [merchantApplications, stores, riderApplications, riders, orders] = await Promise.all([
        fetchAdminApplications(token),
        fetchAdminStores(token),
        fetchAdminDeliveryApplications(token),
        fetchAdminDeliveryRiders(token),
        fetchAdminOrders(token)
      ]);
      if (requestId !== requestIdRef.current) {
        return;
      }
      setData({
        merchantApplications,
        riderApplications,
        riders,
        stores,
        orders
      });
      setError(null);
    } catch (requestError) {
      if (!options?.silent) {
        setError(requestError instanceof Error ? requestError.message : "No se pudo cargar el dashboard");
      }
    } finally {
      if (!options?.silent && requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  useEffect(() => {
    if (!token) return;

    const refreshSilently = () => {
      void load({ silent: true });
    };

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshSilently();
      }
    }, LIVE_REFRESH_INTERVAL_MS);

    const handleFocus = () => refreshSilently();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshSilently();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [token]);

  const overview = useMemo(() => {
    const pendingMerchantApplications = data.merchantApplications.filter(
      (application) => !resolvedMerchantStatuses.has(application.status)
    ).length;
    const pendingRiderApplications = data.riderApplications.filter(
      (application) => application.status === "pending_review"
    ).length;

    return {
      pendingApplications: pendingMerchantApplications + pendingRiderApplications,
      approvedStores: data.stores.filter((store) => store.status === "approved").length,
      activeRiders: data.riders.filter((rider) => rider.is_active).length,
      totalOrders: data.orders.length
    };
  }, [data]);

  const periodStats = useMemo(() => buildNamedPeriodStats(data.orders), [data.orders]);
  const now = useMemo(() => new Date(), [data.orders]);
  const storeRanking = useMemo(() => {
    const dayStart = startOfDay(now);
    const weekStart = startOfWeek(now);
    const monthStart = startOfMonth(now);
    return data.stores
      .map((store) => {
        const storeOrders = data.orders.filter((order) => order.store_id === store.id);
        return {
          store,
          today: buildStoreStats(dateRangeFilter(storeOrders, dayStart, addDays(dayStart, 1))),
          week: buildStoreStats(dateRangeFilter(storeOrders, weekStart, addDays(weekStart, 7))),
          month: buildStoreStats(dateRangeFilter(storeOrders, monthStart, addMonths(monthStart, 1)))
        };
      })
      .sort((left, right) => right.month.sales - left.month.sales)
      .slice(0, 10);
  }, [data.orders, data.stores, now]);

  if (loading) return <LoadingCard />;
  if (error) return <EmptyState title="Dashboard no disponible" description={error} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title={
          <span className="inline-flex items-center gap-3">
            <span>Dashboard</span>
            <HelpTooltip label="Ayuda sobre dashboard" variant="inverse">
              Revisa el estado general del panel y compara el rendimiento de cada comercio.
            </HelpTooltip>
          </span>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Postulaciones pendientes" value={String(overview.pendingApplications)} description="Comercios y riders pendientes de revision." />
        <StatCard label="Comercios aprobados" value={String(overview.approvedStores)} description="Locales habilitados para operar." />
        <StatCard label="Riders activos" value={String(overview.activeRiders)} description="Perfiles de reparto en operacion." />
        <StatCard label="Pedidos totales" value={String(overview.totalOrders)} description="Base acumulada de pedidos." />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {periodStats.map((period) => (
          <article key={period.key} className="rounded-[28px] bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">{period.label}</p>
            <p className="mt-3 font-display text-3xl font-bold tracking-tight text-ink">
              {formatCurrency(period.stats.sales)}
            </p>
            <div className="mt-4 grid gap-2 text-sm text-zinc-600 sm:grid-cols-2">
              <p>Pedidos: {period.stats.orderCount}</p>
              <p>Entregados: {period.stats.deliveredCount}</p>
              <p>Ticket promedio: {formatCurrency(period.stats.averageTicket)}</p>
              <p>Cancelados: {period.stats.cancellationCount}</p>
            </div>
          </article>
        ))}
      </div>

      <section className="rounded-[28px] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Ranking por comercio</p>
            <h2 className="mt-2 text-xl font-bold text-ink">Ventas por comercio</h2>
          </div>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
            top {storeRanking.length}
          </span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-zinc-500">
              <tr>
                <th className="pb-3 pr-4 font-semibold">Comercio</th>
                <th className="pb-3 pr-4 font-semibold">Hoy</th>
                <th className="pb-3 pr-4 font-semibold">Semana</th>
                <th className="pb-3 pr-4 font-semibold">Mes</th>
                <th className="pb-3 pr-4 font-semibold">Ticket mes</th>
                <th className="pb-3 font-semibold">Cancelados mes</th>
              </tr>
            </thead>
            <tbody>
              {storeRanking.map((row) => (
                <tr key={row.store.id} className="border-t border-black/5 align-top">
                  <td className="py-4 pr-4">
                    <p className="font-semibold text-ink">{row.store.name}</p>
                    <p className="mt-1 text-zinc-500">{row.store.primary_category ?? "Sin rubro"}</p>
                  </td>
                  <td className="py-4 pr-4 text-zinc-600">
                    <p>{formatCurrency(row.today.sales)}</p>
                    <p>{row.today.orderCount} pedidos</p>
                  </td>
                  <td className="py-4 pr-4 text-zinc-600">
                    <p>{formatCurrency(row.week.sales)}</p>
                    <p>{row.week.delivered} entregados</p>
                  </td>
                  <td className="py-4 pr-4 text-zinc-600">
                    <p>{formatCurrency(row.month.sales)}</p>
                    <p>{row.month.orderCount} pedidos</p>
                  </td>
                  <td className="py-4 pr-4 text-zinc-600">{formatCurrency(row.month.averageTicket)}</td>
                  <td className="py-4 text-zinc-600">{row.month.cancelled}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!storeRanking.length ? (
          <EmptyState title="Sin comercios para rankear" description="Cuando existan pedidos se armara el ranking automaticamente." />
        ) : null}
      </section>
    </div>
  );
}
