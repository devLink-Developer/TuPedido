import { useEffect, useMemo, useState } from "react";
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
import { formatCurrency } from "../../../shared/utils/format";

type DashboardData = {
  merchantApplications: MerchantApplication[];
  riderApplications: DeliveryApplication[];
  riders: DeliveryProfile[];
  stores: StoreSummary[];
  orders: Order[];
};

type PeriodMetrics = {
  label: string;
  orderCount: number;
  totalAmount: number;
  serviceFeeAmount: number;
};

const emptyDashboardData: DashboardData = {
  merchantApplications: [],
  riderApplications: [],
  riders: [],
  stores: [],
  orders: []
};

const resolvedMerchantStatuses = new Set(["approved", "rejected", "suspended"]);

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

function startOfYear(date: Date) {
  return new Date(date.getFullYear(), 0, 1);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function addYears(date: Date, years: number) {
  return new Date(date.getFullYear() + years, 0, 1);
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function diffMinutes(startValue: string | null | undefined, endValue: string | null | undefined) {
  if (!startValue || !endValue) return null;
  const startMs = new Date(startValue).getTime();
  const endMs = new Date(endValue).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return null;
  return (endMs - startMs) / 60_000;
}

function formatDuration(minutes: number | null) {
  if (minutes === null) return "-";
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const remainingMinutes = rounded % 60;
  if (hours && remainingMinutes) return `${hours}h ${remainingMinutes}m`;
  if (hours) return `${hours}h`;
  if (!remainingMinutes) return "0m";
  return `${remainingMinutes}m`;
}

function formatPercent(value: number | null) {
  if (value === null) return "-";
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value)}%`;
}

function orderCreatedAt(order: Order) {
  return new Date(order.created_at);
}

function buildPeriodMetrics(label: string, orders: Order[], start: Date, end: Date): PeriodMetrics {
  const filteredOrders = orders.filter((order) => {
    const createdAt = orderCreatedAt(order);
    return createdAt >= start && createdAt < end;
  });

  return {
    label,
    orderCount: filteredOrders.length,
    totalAmount: filteredOrders.reduce((sum, order) => sum + order.total, 0),
    serviceFeeAmount: filteredOrders.reduce((sum, order) => sum + order.service_fee, 0)
  };
}

function PeriodCard({ metrics }: { metrics: PeriodMetrics }) {
  return (
    <article className="rounded-[28px] bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">{metrics.label}</p>
      <p className="mt-3 font-display text-3xl font-bold tracking-tight text-ink">{formatCurrency(metrics.totalAmount)}</p>
      <div className="mt-3 space-y-1 text-sm text-zinc-600">
        <p>Pedidos: {metrics.orderCount}</p>
        <p>Servicio: {formatCurrency(metrics.serviceFeeAmount)}</p>
      </div>
    </article>
  );
}

export function DashboardPage() {
  const { token } = useAuthSession();
  const [data, setData] = useState<DashboardData>(emptyDashboardData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      fetchAdminApplications(token),
      fetchAdminStores(token),
      fetchAdminDeliveryApplications(token),
      fetchAdminDeliveryRiders(token),
      fetchAdminOrders(token)
    ])
      .then(([merchantApplications, stores, riderApplications, riders, orders]) => {
        setData({
          merchantApplications,
          riderApplications,
          riders,
          stores,
          orders
        });
        setError(null);
      })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "No se pudo cargar el dashboard"))
      .finally(() => setLoading(false));
  }, [token]);

  const now = useMemo(() => new Date(), []);

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

  const periodMetrics = useMemo(() => {
    const dayStart = startOfDay(now);
    const weekStart = startOfWeek(now);
    const monthStart = startOfMonth(now);
    const yearStart = startOfYear(now);

    return [
      buildPeriodMetrics("Ano actual", data.orders, yearStart, addYears(yearStart, 1)),
      buildPeriodMetrics("Mes actual", data.orders, monthStart, addMonths(monthStart, 1)),
      buildPeriodMetrics("Semana actual", data.orders, weekStart, addDays(weekStart, 7)),
      buildPeriodMetrics("Dia actual", data.orders, dayStart, addDays(dayStart, 1))
    ];
  }, [data.orders, now]);

  const operationalKpis = useMemo(() => {
    const totalAmount = data.orders.reduce((sum, order) => sum + order.total, 0);
    const approvedPayments = data.orders.filter((order) => order.payment_status === "approved").length;
    const deliveredOrders = data.orders.filter((order) => order.status === "delivered").length;
    const deliveryOrders = data.orders.filter((order) => order.delivery_mode === "delivery").length;
    const dispatchPending = data.orders.filter((order) => order.delivery_status === "assignment_pending").length;

    return {
      averageTicket: data.orders.length ? totalAmount / data.orders.length : 0,
      approvedPaymentRate: data.orders.length ? (approvedPayments / data.orders.length) * 100 : null,
      deliveredRate: data.orders.length ? (deliveredOrders / data.orders.length) * 100 : null,
      deliveryShare: data.orders.length ? (deliveryOrders / data.orders.length) * 100 : null,
      dispatchPending
    };
  }, [data.orders]);

  const deliveryTimeKpis = useMemo(() => {
    const completedOrders = data.orders.filter((order) => order.delivered_at);
    const totalCycleTimes = completedOrders
      .map((order) => diffMinutes(order.created_at, order.delivered_at))
      .filter((value): value is number => value !== null);
    const prepTimes = data.orders
      .map((order) => diffMinutes(order.created_at, order.merchant_ready_at))
      .filter((value): value is number => value !== null);
    const readyToDispatchTimes = data.orders
      .map((order) => diffMinutes(order.merchant_ready_at, order.out_for_delivery_at))
      .filter((value): value is number => value !== null);
    const deliveryLegTimes = completedOrders
      .map((order) => diffMinutes(order.out_for_delivery_at, order.delivered_at))
      .filter((value): value is number => value !== null);

    return {
      averageTotalCycle: average(totalCycleTimes),
      averagePreparation: average(prepTimes),
      averageReadyToDispatch: average(readyToDispatchTimes),
      averageDeliveryLeg: average(deliveryLegTimes)
    };
  }, [data.orders]);

  if (loading) return <LoadingCard />;
  if (error) return <EmptyState title="Dashboard no disponible" description={error} />;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Admin" title="Dashboard" description="Resumen central de operacion, performance y tiempos de entrega." />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Postulaciones pendientes" value={String(overview.pendingApplications)} description="Comercios y riders pendientes de revision." />
        <StatCard label="Comercios aprobados" value={String(overview.approvedStores)} description="Locales ya habilitados para operar." />
        <StatCard label="Riders activos" value={String(overview.activeRiders)} description="Perfiles de reparto habilitados." />
        <StatCard label="Pedidos totales" value={String(overview.totalOrders)} description="Volumen acumulado de pedidos." />
      </div>

      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Performance por periodo</p>
          <h2 className="mt-2 text-2xl font-bold text-ink">Pedidos, facturacion y servicio</h2>
        </div>
        <div className="grid gap-4 xl:grid-cols-4">
          {periodMetrics.map((metrics) => (
            <PeriodCard key={metrics.label} metrics={metrics} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">KPIs operativos</p>
          <h2 className="mt-2 text-2xl font-bold text-ink">Calidad de negocio y mix de operacion</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Ticket promedio" value={formatCurrency(operationalKpis.averageTicket)} description="Promedio de pesos por pedido." />
          <StatCard label="Pago aprobado" value={formatPercent(operationalKpis.approvedPaymentRate)} description="Porcentaje de pedidos con cobro aprobado." />
          <StatCard label="Entrega exitosa" value={formatPercent(operationalKpis.deliveredRate)} description="Pedidos cerrados como entregados." />
          <StatCard label="Mix delivery" value={formatPercent(operationalKpis.deliveryShare)} description="Participacion de pedidos con envio." />
          <StatCard label="Dispatch pendiente" value={String(operationalKpis.dispatchPending)} description="Pedidos esperando asignacion de rider." />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">KPIs de tiempo</p>
          <h2 className="mt-2 text-2xl font-bold text-ink">Velocidad real de preparacion y entrega</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Ciclo total medio" value={formatDuration(deliveryTimeKpis.averageTotalCycle)} description="Desde creacion hasta entrega efectiva." />
          <StatCard label="Preparacion media" value={formatDuration(deliveryTimeKpis.averagePreparation)} description="Desde creacion hasta pedido listo." />
          <StatCard label="Espera a salida" value={formatDuration(deliveryTimeKpis.averageReadyToDispatch)} description="Desde listo hasta salida a reparto." />
          <StatCard label="Viaje medio" value={formatDuration(deliveryTimeKpis.averageDeliveryLeg)} description="Desde salida a reparto hasta entrega." />
        </div>
      </section>
    </div>
  );
}
