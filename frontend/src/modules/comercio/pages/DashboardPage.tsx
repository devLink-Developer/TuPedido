import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bike,
  CalendarDays,
  Clock3,
  CreditCard,
  DollarSign,
  PackageSearch,
  ReceiptText,
  Repeat2,
  ShoppingBag,
  TrendingUp,
  Users,
  WalletCards
} from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { EmptyState, LoadingCard, StatusPill } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import {
  fetchMerchantStatsCustomers,
  fetchMerchantStatsDelivery,
  fetchMerchantStatsFinancial,
  fetchMerchantStatsOverview,
  fetchMerchantStatsProducts,
  fetchMerchantStatsSales,
  fetchMerchantStore
} from "../../../shared/services/api";
import type {
  MerchantStatsComparison,
  MerchantStatsCustomers,
  MerchantStatsDelivery,
  MerchantStatsFinancial,
  MerchantStatsOverview,
  MerchantStatsProducts,
  MerchantStatsQuery,
  MerchantStatsSales,
  MerchantStore
} from "../../../shared/types";
import { HelpTooltip } from "../../../shared/ui/HelpTooltip";
import { formatCurrency } from "../../../shared/utils/format";
import { MerchantPageBar } from "../components/MerchantPageBar";
import { useMerchantStoreStatusSync } from "../hooks/useMerchantStoreStatusSync";

const DashboardCharts = lazy(() =>
  import("../components/DashboardCharts").then((module) => ({ default: module.DashboardCharts }))
);

type PeriodPreset = "today" | "yesterday" | "last_7_days" | "last_30_days" | "this_month" | "last_month" | "custom";
type ChartMode = "money" | "orders";

type DashboardFilters = MerchantStatsQuery & {
  preset: PeriodPreset;
};

type SecondaryStats = {
  sales: MerchantStatsSales | null;
  products: MerchantStatsProducts | null;
  customers: MerchantStatsCustomers | null;
  delivery: MerchantStatsDelivery | null;
};

const FILTER_STORAGE_KEY = "kepedimos:merchant-dashboard-filters";
const dashboardMessages: Record<string, { title: string; description: string }> = {
  pending_review: {
    title: "Solicitud en revision",
    description: "Puedes seguir ajustando catalogo, identidad y medios de cobro. El local seguira cerrado hasta la aprobacion."
  },
  approved: {
    title: "Listo para operar",
    description: "El dashboard toma datos reales de pedidos, clientes, delivery y liquidaciones para ayudarte a decidir rapido."
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

const periodOptions: Array<{ value: PeriodPreset; label: string }> = [
  { value: "today", label: "Hoy" },
  { value: "yesterday", label: "Ayer" },
  { value: "last_7_days", label: "Ultimos 7 dias" },
  { value: "last_30_days", label: "Ultimos 30 dias" },
  { value: "this_month", label: "Este mes" },
  { value: "last_month", label: "Mes pasado" },
  { value: "custom", label: "Personalizado" }
];

const comparisonOptions: Array<{ value: MerchantStatsComparison; label: string }> = [
  { value: "previous_period", label: "Periodo anterior" },
  { value: "same_week_previous", label: "Misma semana anterior" },
  { value: "same_month_previous", label: "Mismo mes anterior" }
];

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function resolvePresetRange(preset: PeriodPreset, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === "today") return { startDate: localDateKey(today), endDate: localDateKey(today) };
  if (preset === "yesterday") {
    const yesterday = addDays(today, -1);
    return { startDate: localDateKey(yesterday), endDate: localDateKey(yesterday) };
  }
  if (preset === "last_7_days") return { startDate: localDateKey(addDays(today, -6)), endDate: localDateKey(today) };
  if (preset === "this_month") return { startDate: localDateKey(startOfMonth(today)), endDate: localDateKey(today) };
  if (preset === "last_month") {
    const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return { startDate: localDateKey(startOfMonth(previousMonth)), endDate: localDateKey(endOfMonth(previousMonth)) };
  }
  return { startDate: localDateKey(addDays(today, -29)), endDate: localDateKey(today) };
}

function defaultFilters(): DashboardFilters {
  return {
    preset: "last_30_days",
    ...resolvePresetRange("last_30_days"),
    comparison: "previous_period"
  };
}

function readStoredFilters(): DashboardFilters {
  if (typeof window === "undefined") return defaultFilters();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FILTER_STORAGE_KEY) || "null") as Partial<DashboardFilters> | null;
    if (parsed?.startDate && parsed?.endDate && parsed?.comparison && parsed?.preset) {
      return {
        preset: parsed.preset,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        comparison: parsed.comparison
      };
    }
  } catch {
    return defaultFilters();
  }
  return defaultFilters();
}

function formatPercent(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)}%`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-AR").format(value);
}

function formatMinutes(value: number) {
  return value > 0 ? `${value.toFixed(0)} min` : "Sin datos";
}

function trendTone(value: number, inverse = false) {
  const positive = inverse ? value <= 0 : value >= 0;
  if (value === 0) return "neutral";
  return positive ? "success" : "danger";
}

function TrendBadge({ value, inverse = false, suffix = "vs comparacion" }: { value: number; inverse?: boolean; suffix?: string }) {
  const tone = trendTone(value, inverse);
  const Icon = value >= 0 ? ArrowUpRight : ArrowDownRight;
  const className =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "danger"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-zinc-200 bg-zinc-50 text-zinc-600";
  return (
    <span className={`inline-flex min-h-7 items-center gap-1 rounded border px-2 text-xs font-bold ${className}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {formatPercent(value)} {suffix}
    </span>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  description,
  trend,
  inverseTrend = false,
  tone = "neutral"
}: {
  icon: typeof DollarSign;
  label: string;
  value: ReactNode;
  description?: ReactNode;
  trend?: number;
  inverseTrend?: boolean;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : tone === "danger"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-[rgba(255,106,26,0.18)] bg-[var(--kp-accent-soft)] text-[var(--kp-accent)]";

  return (
    <article className="app-panel min-w-[236px] p-4 lg:min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">{label}</p>
          <p className="mt-2 font-display text-2xl font-bold leading-tight text-ink">{value}</p>
        </div>
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded border ${toneClass}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      {description ? <div className="mt-3 min-h-10 text-sm leading-5 text-zinc-600">{description}</div> : null}
      {typeof trend === "number" ? (
        <div className="mt-3">
          <TrendBadge value={trend} inverse={inverseTrend} />
        </div>
      ) : null}
    </article>
  );
}

function SectionShell({
  eyebrow,
  title,
  description,
  action,
  children,
  className = ""
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`app-panel p-4 sm:p-5 ${className}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--kp-accent)]">{eyebrow}</p>
          <h2 className="mt-1.5 text-xl font-bold leading-tight text-ink">{title}</h2>
          {description ? <p className="mt-1.5 max-w-2xl text-sm leading-6 text-zinc-600">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SectionLoading({ label }: { label: string }) {
  return (
    <div className="app-panel p-5" aria-live="polite">
      <p className="text-sm font-semibold text-zinc-600">{label}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-24 animate-pulse rounded bg-zinc-100" />
        ))}
      </div>
    </div>
  );
}

function EmptyPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded border border-dashed border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-600">
      <p className="font-bold text-ink">{title}</p>
      <p className="mt-1.5 leading-6">{description}</p>
    </div>
  );
}

function DashboardFiltersBar({
  filters,
  onChange
}: {
  filters: DashboardFilters;
  onChange: (filters: DashboardFilters) => void;
}) {
  function setPreset(preset: PeriodPreset) {
    if (preset === "custom") {
      onChange({ ...filters, preset });
      return;
    }
    onChange({ ...filters, preset, ...resolvePresetRange(preset) });
  }

  return (
    <section className="app-panel sticky top-2 z-10 p-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--kp-accent)]">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            Filtros globales
          </p>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {periodOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPreset(option.value)}
                className={`min-h-10 shrink-0 rounded border px-3 text-sm font-bold transition ${
                  filters.preset === option.value
                    ? "border-[var(--kp-accent)] bg-[var(--kp-accent)] text-white"
                    : "border-[var(--kp-stroke)] bg-white text-zinc-700 hover:border-[rgba(255,106,26,0.35)]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1.35fr] xl:min-w-[580px]">
          <label className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">
            Desde
            <input
              type="date"
              value={filters.startDate}
              onChange={(event) => onChange({ ...filters, preset: "custom", startDate: event.target.value })}
              className="mt-1 min-h-11 w-full rounded border border-[var(--kp-stroke)] bg-white px-3 text-sm font-semibold normal-case tracking-normal text-ink"
            />
          </label>
          <label className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">
            Hasta
            <input
              type="date"
              value={filters.endDate}
              onChange={(event) => onChange({ ...filters, preset: "custom", endDate: event.target.value })}
              className="mt-1 min-h-11 w-full rounded border border-[var(--kp-stroke)] bg-white px-3 text-sm font-semibold normal-case tracking-normal text-ink"
            />
          </label>
          <label className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">
            Comparacion
            <select
              value={filters.comparison}
              onChange={(event) => onChange({ ...filters, comparison: event.target.value as MerchantStatsComparison })}
              className="mt-1 min-h-11 w-full rounded border border-[var(--kp-stroke)] bg-white px-3 text-sm font-semibold normal-case tracking-normal text-ink"
            >
              {comparisonOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </section>
  );
}

function InsightsPanel({
  overview,
  products,
  delivery
}: {
  overview: MerchantStatsOverview;
  products: MerchantStatsProducts | null;
  delivery: MerchantStatsDelivery | null;
}) {
  const productAlerts = products?.low_performance.slice(0, 2).map((item) => ({
    tone: item.severity,
    title: item.product_name,
    description: `${item.reason}. ${item.recommendation}`
  })) ?? [];
  const deliveryAlert =
    delivery && delivery.costs.profit < 0
      ? [
          {
            tone: "warning" as const,
            title: "Delivery subsidiado",
            description: `El delivery dejo ${formatCurrency(delivery.costs.profit)} en el periodo. Revisa cobertura o tarifa.`
          }
        ]
      : [];
  const insights = [...overview.insights, ...productAlerts, ...deliveryAlert].slice(0, 5);

  return (
    <SectionShell
      eyebrow="Insights"
      title="Lectura ejecutiva"
      description="Alertas automaticas para entender rapido que funciona, que cae y donde actuar."
    >
      <div className="grid gap-3 lg:grid-cols-5">
        {insights.map((insight, index) => {
          const className =
            insight.tone === "success"
              ? "border-emerald-200 bg-emerald-50"
              : insight.tone === "danger"
                ? "border-rose-200 bg-rose-50"
                : insight.tone === "warning"
                  ? "border-amber-200 bg-amber-50"
                  : "border-zinc-200 bg-zinc-50";
          return (
            <article key={`${insight.title}-${index}`} className={`rounded border p-3 ${className}`}>
              <p className="text-sm font-bold text-ink">{insight.title}</p>
              <p className="mt-1.5 text-sm leading-5 text-zinc-700">{insight.description}</p>
            </article>
          );
        })}
      </div>
    </SectionShell>
  );
}

function ProductsSection({ products }: { products: MerchantStatsProducts }) {
  const maxRevenue = Math.max(...products.top_products.map((item) => item.revenue), 1);

  return (
    <div className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
      <SectionShell eyebrow="Productos" title="Productos mas vendidos" description="Cantidad, facturacion, margen estimado y tendencia contra la comparacion.">
        {products.top_products.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--kp-stroke)] text-xs uppercase tracking-[0.14em] text-zinc-400">
                  <th className="py-2 pr-3">Producto</th>
                  <th className="py-2 pr-3">Cantidad</th>
                  <th className="py-2 pr-3">Facturacion</th>
                  <th className="py-2 pr-3">Margen</th>
                  <th className="py-2">Tendencia</th>
                </tr>
              </thead>
              <tbody>
                {products.top_products.map((item) => (
                  <tr key={`${item.product_id}-${item.product_name}`} className="border-b border-zinc-100 last:border-0">
                    <td className="py-3 pr-3">
                      <p className="font-bold text-ink">{item.product_name}</p>
                      <div className="mt-2 h-2 rounded bg-zinc-100">
                        <div
                          className="h-2 rounded bg-[var(--kp-accent)]"
                          style={{ width: `${Math.max(8, (item.revenue / maxRevenue) * 100)}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-3 pr-3 font-semibold text-zinc-700">{formatNumber(item.quantity_sold)}</td>
                    <td className="py-3 pr-3 font-semibold text-ink">{formatCurrency(item.revenue)}</td>
                    <td className="py-3 pr-3 font-semibold text-zinc-700">{formatCurrency(item.margin)}</td>
                    <td className="py-3">
                      <TrendBadge value={item.trend_pct} suffix="" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyPanel title="Sin ventas de productos" description="Cuando haya pedidos entregados se mostrara el ranking de productos." />
        )}
      </SectionShell>

      <SectionShell eyebrow="Acciones" title="Bajo rendimiento" description="Productos con caidas o sin ventas para revisar precio, stock o posicion.">
        <div className="space-y-2">
          {products.low_performance.map((item) => (
            <article
              key={`${item.product_id}-${item.product_name}`}
              className={`rounded border p-3 ${
                item.severity === "danger"
                  ? "border-rose-200 bg-rose-50"
                  : item.severity === "warning"
                    ? "border-amber-200 bg-amber-50"
                    : "border-zinc-200 bg-zinc-50"
              }`}
            >
              <p className="font-bold text-ink">{item.product_name}</p>
              <p className="mt-1 text-sm font-semibold text-zinc-700">{item.reason}</p>
              <p className="mt-1 text-sm leading-5 text-zinc-600">{item.recommendation}</p>
            </article>
          ))}
          {!products.low_performance.length ? (
            <EmptyPanel title="Sin alertas de producto" description="No hay caidas fuertes ni productos sin ventas en este periodo." />
          ) : null}
        </div>
      </SectionShell>
    </div>
  );
}

function DeliverySection({ delivery }: { delivery: MerchantStatsDelivery }) {
  return (
    <div className="grid gap-3 xl:grid-cols-[1.1fr_0.9fr]">
      <SectionShell eyebrow="Delivery" title="Rendimiento por repartidor" description="Pedidos entregados, tiempo promedio, cancelaciones e ingresos generados.">
        {delivery.riders.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--kp-stroke)] text-xs uppercase tracking-[0.14em] text-zinc-400">
                  <th className="py-2 pr-3">Repartidor</th>
                  <th className="py-2 pr-3">Entregados</th>
                  <th className="py-2 pr-3">Tiempo prom.</th>
                  <th className="py-2 pr-3">Cancelados</th>
                  <th className="py-2">Ingresos</th>
                </tr>
              </thead>
              <tbody>
                {delivery.riders.map((rider) => (
                  <tr key={rider.rider_user_id} className="border-b border-zinc-100 last:border-0">
                    <td className="py-3 pr-3 font-bold text-ink">{rider.rider_name}</td>
                    <td className="py-3 pr-3 font-semibold text-zinc-700">{rider.delivered_orders}</td>
                    <td className="py-3 pr-3 text-zinc-600">{formatMinutes(rider.avg_delivery_minutes)}</td>
                    <td className="py-3 pr-3 text-zinc-600">{rider.cancelled_orders}</td>
                    <td className="py-3 font-semibold text-ink">{formatCurrency(rider.generated_revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyPanel title="Sin repartidores medidos" description="Cuando haya entregas asignadas se vera el rendimiento por repartidor." />
        )}
      </SectionShell>

      <SectionShell eyebrow="Cobertura" title="Zonas y costo de delivery" description="Detecta demanda por zona y si el envio esta subsidiado.">
        <div className="grid gap-3 sm:grid-cols-2">
          <KpiMini label="Delivery cobrado" value={formatCurrency(delivery.costs.delivery_charged)} />
          <KpiMini label="Costo rider" value={formatCurrency(delivery.costs.rider_cost)} />
          <KpiMini label="Subsidio" value={formatCurrency(delivery.costs.subsidized)} tone={delivery.costs.subsidized > 0 ? "warning" : "success"} />
          <KpiMini label="Distancia prom." value={`${delivery.distance.average_km.toFixed(1)} km`} />
        </div>
        <div className="mt-4 space-y-2">
          {delivery.zones.map((zone) => (
            <div key={zone.zone} className="flex items-center justify-between gap-3 rounded border border-[var(--kp-stroke)] bg-zinc-50 px-3 py-2">
              <span className="min-w-0 truncate text-sm font-bold text-ink">{zone.zone}</span>
              <span className="text-sm font-semibold text-zinc-600">{zone.orders} pedidos</span>
            </div>
          ))}
          {!delivery.zones.length ? <EmptyPanel title="Sin zonas" description="No hay pedidos con entrega para rankear zonas." /> : null}
        </div>
      </SectionShell>
    </div>
  );
}

function KpiMini({ label, value, tone = "neutral" }: { label: string; value: ReactNode; tone?: "neutral" | "success" | "warning" }) {
  const className =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50"
        : "border-[var(--kp-stroke)] bg-zinc-50";
  return (
    <div className={`rounded border p-3 ${className}`}>
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-400">{label}</p>
      <p className="mt-1.5 text-lg font-bold text-ink">{value}</p>
    </div>
  );
}

export function DashboardPage() {
  const { token } = useAuthSession();
  const [store, setStore] = useState<MerchantStore | null>(null);
  const [overview, setOverview] = useState<MerchantStatsOverview | null>(null);
  const [financial, setFinancial] = useState<MerchantStatsFinancial | null>(null);
  const [secondary, setSecondary] = useState<SecondaryStats>({ sales: null, products: null, customers: null, delivery: null });
  const [filters, setFilters] = useState<DashboardFilters>(() => readStoredFilters());
  const [chartMode, setChartMode] = useState<ChartMode>("money");
  const [loadingPrimary, setLoadingPrimary] = useState(true);
  const [loadingSecondary, setLoadingSecondary] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [secondaryError, setSecondaryError] = useState<string | null>(null);

  const statsQuery = useMemo<MerchantStatsQuery>(
    () => ({
      startDate: filters.startDate,
      endDate: filters.endDate,
      comparison: filters.comparison
    }),
    [filters.comparison, filters.endDate, filters.startDate]
  );
  const queryKey = JSON.stringify(statsQuery);

  useEffect(() => {
    window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    setLoadingPrimary(true);
    setError(null);
    setOverview(null);
    setFinancial(null);
    setSecondary({ sales: null, products: null, customers: null, delivery: null });
    setLoadingSecondary(true);
    setSecondaryError(null);

    Promise.all([
      fetchMerchantStore(token),
      fetchMerchantStatsOverview(token, statsQuery),
      fetchMerchantStatsFinancial(token, statsQuery)
    ])
      .then(([storeResult, overviewResult, financialResult]) => {
        if (!active) return;
        setStore(storeResult);
        setOverview(overviewResult);
        setFinancial(financialResult);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError instanceof Error ? requestError.message : "No se pudo cargar el dashboard");
      })
      .finally(() => {
        if (active) setLoadingPrimary(false);
      });

    Promise.all([
      fetchMerchantStatsSales(token, statsQuery),
      fetchMerchantStatsProducts(token, statsQuery),
      fetchMerchantStatsCustomers(token, statsQuery),
      fetchMerchantStatsDelivery(token, statsQuery)
    ])
      .then(([sales, products, customers, delivery]) => {
        if (!active) return;
        setSecondary({ sales, products, customers, delivery });
      })
      .catch((requestError) => {
        if (!active) return;
        setSecondaryError(requestError instanceof Error ? requestError.message : "No se pudieron cargar algunos analisis");
      })
      .finally(() => {
        if (active) setLoadingSecondary(false);
      });

    return () => {
      active = false;
    };
  }, [queryKey, statsQuery, token]);

  useMerchantStoreStatusSync({ store, setStore });

  const approvalMessage = useMemo(() => {
    if (!store) return null;
    return dashboardMessages[store.status] ?? dashboardMessages.pending_review;
  }, [store]);

  if (loadingPrimary && !overview) return <LoadingCard label="Cargando dashboard analitico..." />;
  if (error) return <EmptyState title="Dashboard no disponible" description={error} />;
  if (!store || !overview || !financial) {
    return <EmptyState title="Comercio no disponible" description="No se pudo cargar la informacion principal del comercio." />;
  }

  const kpis = overview.kpis;

  return (
    <div className="space-y-3">
      <MerchantPageBar
        eyebrow="Analytics"
        title={
          <span className="inline-flex items-center gap-3">
            <span>{store.name}</span>
            <HelpTooltip label="Ayuda sobre dashboard">
              Este panel resume ventas, pedidos, clientes, productos, delivery y finanzas del periodo seleccionado.
            </HelpTooltip>
          </span>
        }
        description={`${filters.startDate} a ${filters.endDate}`}
        stats={[
          { label: "Ventas", value: formatCurrency(kpis.gross_sales), tone: "success" },
          { label: "Pedidos", value: kpis.total_orders },
          { label: "Ticket", value: formatCurrency(kpis.average_ticket) },
          { label: "Cancelacion", value: `${kpis.cancellation_rate.toFixed(1)}%`, tone: kpis.cancellation_rate >= 8 ? "danger" : "neutral" }
        ]}
      />

      <DashboardFiltersBar filters={filters} onChange={setFilters} />

      {approvalMessage ? (
        <section className="app-panel p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Estado comercial</p>
              <h2 className="mt-1 text-lg font-bold text-ink">{approvalMessage.title}</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-600">{approvalMessage.description}</p>
            </div>
            <StatusPill value={store.status} />
          </div>
        </section>
      ) : null}

      <section className="grid auto-cols-[minmax(236px,1fr)] grid-flow-col gap-3 overflow-x-auto pb-1 lg:grid-flow-row lg:grid-cols-4 xl:grid-cols-5">
        <KpiCard
          icon={DollarSign}
          label="Ventas brutas"
          value={formatCurrency(kpis.gross_sales)}
          description={`Neto estimado: ${formatCurrency(kpis.net_sales)}`}
          trend={kpis.gross_sales_change_pct}
          tone="success"
        />
        <KpiCard
          icon={ShoppingBag}
          label="Pedidos"
          value={formatNumber(kpis.total_orders)}
          description={`${kpis.delivered_orders} entregados | ${kpis.cancelled_orders} cancelados`}
          trend={kpis.total_orders_change_pct}
        />
        <KpiCard
          icon={ReceiptText}
          label="Ticket promedio"
          value={formatCurrency(kpis.average_ticket)}
          description="Valor promedio de pedidos entregados."
          trend={kpis.average_ticket_change_pct}
        />
        <KpiCard
          icon={Users}
          label="Clientes unicos"
          value={formatNumber(kpis.unique_customers)}
          description={`Recompra: ${kpis.repeat_rate.toFixed(1)}%`}
          tone="neutral"
        />
        <KpiCard
          icon={Repeat2}
          label="Recompra"
          value={`${kpis.repeat_rate.toFixed(1)}%`}
          description="Clientes que volvieron a comprar."
          tone={kpis.repeat_rate >= 25 ? "success" : "warning"}
        />
        <KpiCard
          icon={Clock3}
          label="Preparacion"
          value={formatMinutes(kpis.avg_preparation_minutes)}
          description="Promedio desde pedido creado hasta listo."
          tone={kpis.avg_preparation_minutes > 25 ? "warning" : "neutral"}
        />
        <KpiCard
          icon={Bike}
          label="Entrega"
          value={formatMinutes(kpis.avg_delivery_minutes)}
          description="Promedio desde salida hasta entrega."
          tone={kpis.avg_delivery_minutes > 35 ? "warning" : "neutral"}
        />
        <KpiCard
          icon={AlertTriangle}
          label="Cancelacion"
          value={`${kpis.cancellation_rate.toFixed(1)}%`}
          description={`${kpis.cancelled_orders + kpis.rejected_orders} pedidos no completados`}
          trend={kpis.cancellation_rate_change_pct}
          inverseTrend
          tone={kpis.cancellation_rate >= 8 ? "danger" : "neutral"}
        />
        <KpiCard
          icon={WalletCards}
          label="Pendiente"
          value={formatCurrency(financial.settlements.pending_balance)}
          description="Saldo pendiente de liquidacion."
          tone={financial.settlements.pending_balance > 0 ? "warning" : "success"}
        />
        <KpiCard
          icon={CreditCard}
          label="Liquidado"
          value={formatCurrency(financial.settlements.paid_balance)}
          description="Historico cobrado registrado."
          tone="success"
        />
      </section>

      <InsightsPanel overview={overview} products={secondary.products} delivery={secondary.delivery} />

      {secondaryError ? (
        <EmptyState title="Analisis parcial" description={secondaryError} />
      ) : loadingSecondary ? (
        <SectionLoading label="Cargando graficos y rankings..." />
      ) : (
        <>
          <Suspense fallback={<SectionLoading label="Preparando graficos..." />}>
            <DashboardCharts
              sales={secondary.sales}
              customers={secondary.customers}
              financial={financial}
              chartMode={chartMode}
              setChartMode={setChartMode}
            />
          </Suspense>
          {secondary.products ? <ProductsSection products={secondary.products} /> : null}
          {secondary.delivery ? <DeliverySection delivery={secondary.delivery} /> : null}
        </>
      )}

      <section className="grid gap-3 md:grid-cols-3">
        <article className="app-panel p-4">
          <BarChart3 className="h-5 w-5 text-[var(--kp-accent)]" aria-hidden="true" />
          <h3 className="mt-2 font-bold text-ink">Decision rapida</h3>
          <p className="mt-1.5 text-sm leading-6 text-zinc-600">Abre este panel y mira primero tendencia de ventas, cancelacion y productos en baja.</p>
        </article>
        <article className="app-panel p-4">
          <PackageSearch className="h-5 w-5 text-[var(--kp-accent)]" aria-hidden="true" />
          <h3 className="mt-2 font-bold text-ink">Catalogo accionable</h3>
          <p className="mt-1.5 text-sm leading-6 text-zinc-600">Usa el bloque de bajo rendimiento para pausar, promocionar o reubicar productos.</p>
        </article>
        <article className="app-panel p-4">
          <TrendingUp className="h-5 w-5 text-[var(--kp-accent)]" aria-hidden="true" />
          <h3 className="mt-2 font-bold text-ink">Operacion rentable</h3>
          <p className="mt-1.5 text-sm leading-6 text-zinc-600">Cruza horarios, delivery y caja para reforzar personal solo donde hay demanda real.</p>
        </article>
      </section>
    </div>
  );
}
