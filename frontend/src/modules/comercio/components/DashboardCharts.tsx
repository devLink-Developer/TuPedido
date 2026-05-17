import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { MerchantStatsCustomers, MerchantStatsFinancial, MerchantStatsSales } from "../../../shared/types";
import { formatCurrency } from "../../../shared/utils/format";

type ChartMode = "money" | "orders";

const chartTooltipStyle = {
  border: "1px solid rgba(255,106,26,0.18)",
  borderRadius: 8,
  boxShadow: "0 18px 42px -28px rgba(24,19,18,0.24)",
  fontSize: 12
};

const chartColors = {
  primary: "#ff6a1a",
  primarySoft: "#fed7aa",
  success: "#059669",
  ink: "#151515"
};

function chartNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (Array.isArray(value)) return Number(value[0] ?? 0);
  return Number(value ?? 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-AR").format(value);
}

function formatDays(value: number | null | undefined) {
  if (!value) return "Sin datos";
  return `${value.toFixed(1)} dias`;
}

function paymentMethodLabel(value: string) {
  if (value === "cash") return "Efectivo";
  if (value === "mercadopago") return "Mercado Pago";
  if (value === "transfer") return "Transferencia";
  return value;
}

function SectionShell({
  eyebrow,
  title,
  description,
  action,
  children
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="app-panel p-4 sm:p-5">
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

function EmptyPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded border border-dashed border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-600">
      <p className="font-bold text-ink">{title}</p>
      <p className="mt-1.5 leading-6">{description}</p>
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

function SalesSection({
  sales,
  chartMode,
  setChartMode
}: {
  sales: MerchantStatsSales;
  chartMode: ChartMode;
  setChartMode: (mode: ChartMode) => void;
}) {
  const strongestHour = [...sales.hourly].sort((a, b) => b.orders - a.orders)[0];
  const strongestDay = [...sales.weekdays].sort((a, b) => b.gross_sales - a.gross_sales)[0];

  return (
    <div className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
      <SectionShell
        eyebrow="Ventas"
        title="Evolucion de ventas"
        description="Ventas y pedidos por dia para detectar tendencia, picos y caidas."
        action={
          <div className="inline-flex rounded border border-[var(--kp-stroke)] bg-white p-1">
            {(["money", "orders"] as ChartMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setChartMode(mode)}
                className={`min-h-9 rounded px-3 text-sm font-bold ${
                  chartMode === mode ? "bg-[var(--kp-accent)] text-white" : "text-zinc-600"
                }`}
              >
                {mode === "money" ? "Dinero" : "Pedidos"}
              </button>
            ))}
          </div>
        }
      >
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sales.daily} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColors.primary} stopOpacity={0.34} />
                  <stop offset="95%" stopColor={chartColors.primary} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#f1e7df" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} width={56} />
              <Tooltip
                contentStyle={chartTooltipStyle}
                formatter={(value, name) => [
                  chartMode === "money" ? formatCurrency(chartNumber(value)) : formatNumber(chartNumber(value)),
                  name === "gross_sales" ? "Ventas" : "Pedidos"
                ]}
              />
              <Area
                type="monotone"
                dataKey={chartMode === "money" ? "gross_sales" : "orders"}
                stroke={chartColors.primary}
                strokeWidth={3}
                fill="url(#salesGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </SectionShell>

      <SectionShell eyebrow="Actividad" title="Horarios y dias fuertes" description="Usa estos picos para personal, stock y repartidores.">
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <KpiMini label="Hora pico" value={strongestHour?.label ?? "Sin datos"} />
            <KpiMini label="Mejor dia" value={strongestDay ? `${strongestDay.label} · ${formatCurrency(strongestDay.gross_sales)}` : "Sin datos"} />
          </div>
          <div className="h-[190px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sales.hourly}>
                <CartesianGrid stroke="#f1e7df" vertical={false} />
                <XAxis dataKey="hour" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} interval={2} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={32} />
                <Tooltip contentStyle={chartTooltipStyle} formatter={(value) => [formatNumber(chartNumber(value)), "Pedidos"]} />
                <Bar dataKey="orders" radius={[6, 6, 0, 0]} fill={chartColors.primary} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={sales.weekdays}>
                <CartesianGrid stroke="#f1e7df" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={48} />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(value, name) => [
                    formatCurrency(chartNumber(value)),
                    name === "average_ticket" ? "Ticket promedio" : "Ventas"
                  ]}
                />
                <Bar dataKey="gross_sales" radius={[6, 6, 0, 0]} fill={chartColors.primarySoft} />
                <Line type="monotone" dataKey="average_ticket" stroke={chartColors.ink} strokeWidth={2.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </SectionShell>
    </div>
  );
}

function CustomersSection({ customers }: { customers: MerchantStatsCustomers }) {
  const customerBars = [
    { label: "Nuevos", value: customers.new_vs_recurrent.new_customers, fill: chartColors.primary },
    { label: "Recurrentes", value: customers.new_vs_recurrent.recurrent_customers, fill: chartColors.success }
  ];

  return (
    <div className="grid gap-3 xl:grid-cols-[0.8fr_1.2fr]">
      <SectionShell eyebrow="Clientes" title="Nuevos vs recurrentes" description="Mide si estas captando demanda nueva o construyendo recompra.">
        <div className="h-[230px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={customerBars}>
              <CartesianGrid stroke="#f1e7df" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={chartTooltipStyle} formatter={(value) => [formatNumber(chartNumber(value)), "Clientes"]} />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {customerBars.map((entry) => (
                  <Cell key={entry.label} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 rounded border border-[var(--kp-stroke)] bg-zinc-50 p-3">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">Frecuencia promedio</p>
          <p className="mt-2 text-xl font-bold text-ink">{formatDays(customers.frequency.average_days_between_orders)}</p>
        </div>
      </SectionShell>

      <SectionShell eyebrow="Valor" title="Clientes mas valiosos" description="Compradores con mayor gasto, pedidos y frecuencia.">
        {customers.top_customers.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-[620px] w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--kp-stroke)] text-xs uppercase tracking-[0.14em] text-zinc-400">
                  <th className="py-2 pr-3">Cliente</th>
                  <th className="py-2 pr-3">Pedidos</th>
                  <th className="py-2 pr-3">Gastado</th>
                  <th className="py-2">Frecuencia</th>
                </tr>
              </thead>
              <tbody>
                {customers.top_customers.map((customer) => (
                  <tr key={customer.customer_id} className="border-b border-zinc-100 last:border-0">
                    <td className="py-3 pr-3 font-bold text-ink">{customer.customer_name}</td>
                    <td className="py-3 pr-3 font-semibold text-zinc-700">{customer.orders}</td>
                    <td className="py-3 pr-3 font-semibold text-ink">{formatCurrency(customer.total_spent)}</td>
                    <td className="py-3 text-zinc-600">{formatDays(customer.frequency_days)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyPanel title="Sin clientes en el periodo" description="Los compradores recurrentes apareceran cuando existan pedidos visibles." />
        )}
      </SectionShell>
    </div>
  );
}

function FinancialSection({ financial }: { financial: MerchantStatsFinancial }) {
  return (
    <div className="grid gap-3 xl:grid-cols-[0.8fr_1.2fr]">
      <SectionShell eyebrow="Finanzas" title="Liquidaciones y metodos de pago" description="Pendientes, cobradas y composicion de cobro del periodo.">
        <div className="grid gap-3 sm:grid-cols-2">
          <KpiMini label="Pendiente" value={formatCurrency(financial.settlements.pending_balance)} tone={financial.settlements.pending_balance > 0 ? "warning" : "success"} />
          <KpiMini label="Liquidado" value={formatCurrency(financial.settlements.paid_balance)} />
          <KpiMini label="Cargos abiertos" value={financial.settlements.open_charges_count ?? financial.settlements.pending_charges_count} />
          <KpiMini label="Avisos pendientes" value={financial.settlements.pending_notices_count} />
        </div>
        <div className="mt-4 h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={financial.payment_methods}>
              <CartesianGrid stroke="#f1e7df" vertical={false} />
              <XAxis dataKey={(item) => paymentMethodLabel(item.method)} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} width={52} />
              <Tooltip
                contentStyle={chartTooltipStyle}
                formatter={(value, name) => [
                  name === "total" ? formatCurrency(chartNumber(value)) : formatNumber(chartNumber(value)),
                  name === "total" ? "Total" : "Pedidos"
                ]}
              />
              <Bar dataKey="total" radius={[8, 8, 0, 0]} fill={chartColors.primary} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionShell>

      <SectionShell eyebrow="Caja" title="Flujo de caja diario" description="Ingresos diarios menos fee de servicio y costo estimado de delivery.">
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={financial.cashflow} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="cashflowGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColors.success} stopOpacity={0.28} />
                  <stop offset="95%" stopColor={chartColors.success} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#f1e7df" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} width={56} />
              <Tooltip
                contentStyle={chartTooltipStyle}
                formatter={(value, name) => [formatCurrency(chartNumber(value)), name === "net_cash" ? "Caja neta" : "Ingresos"]}
              />
              <Legend />
              <Area type="monotone" dataKey="revenue" name="Ingresos" stroke={chartColors.primary} fill="url(#cashflowGradient)" strokeWidth={2.5} />
              <Line type="monotone" dataKey="net_cash" name="Caja neta" stroke={chartColors.success} strokeWidth={2.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </SectionShell>
    </div>
  );
}

export function DashboardCharts({
  sales,
  customers,
  financial,
  chartMode,
  setChartMode
}: {
  sales: MerchantStatsSales | null;
  customers: MerchantStatsCustomers | null;
  financial: MerchantStatsFinancial;
  chartMode: ChartMode;
  setChartMode: (mode: ChartMode) => void;
}) {
  return (
    <>
      {sales ? <SalesSection sales={sales} chartMode={chartMode} setChartMode={setChartMode} /> : null}
      {customers ? <CustomersSection customers={customers} /> : null}
      <FinancialSection financial={financial} />
    </>
  );
}
