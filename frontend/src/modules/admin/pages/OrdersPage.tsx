import { useEffect, useMemo, useState } from "react";
import { EmptyState, LoadingCard, PageHeader, StatCard } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import { fetchAdminOrders, fetchAdminStores } from "../../../shared/services/api";
import type { Order, StoreSummary } from "../../../shared/types";
import { formatCurrency, formatDateTime } from "../../../shared/utils/format";
import { buildNamedPeriodStats } from "../../../shared/utils/orderAnalytics";
import { paymentMethodLabels, statusLabels } from "../../../shared/utils/labels";

type OrderFilters = {
  status: string;
  paymentMethod: string;
  deliveryMode: string;
  storeId: string;
  fromDate: string;
  toDate: string;
};

const deliveryModeLabels: Record<string, string> = {
  delivery: "Envio",
  pickup: "Retiro"
};

function toDateInputValue(date: Date) {
  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function matchesOrder(order: Order, filters: OrderFilters) {
  const orderDate = toDateInputValue(new Date(order.created_at));
  return (
    (!filters.status || order.status === filters.status) &&
    (!filters.paymentMethod || order.payment_method === filters.paymentMethod) &&
    (!filters.deliveryMode || order.delivery_mode === filters.deliveryMode) &&
    (!filters.storeId || String(order.store_id) === filters.storeId) &&
    (!filters.fromDate || orderDate >= filters.fromDate) &&
    (!filters.toDate || orderDate <= filters.toDate)
  );
}

function uniqueValues(items: string[]) {
  return Array.from(new Set(items));
}

export function OrdersPage() {
  const { token } = useAuthSession();
  const today = useMemo(() => toDateInputValue(new Date()), []);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("");
  const [deliveryModeFilter, setDeliveryModeFilter] = useState("");
  const [storeFilter, setStoreFilter] = useState("");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const [items, storeItems] = await Promise.all([fetchAdminOrders(token), fetchAdminStores(token)]);
      setOrders(items);
      setStores(storeItems);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudieron cargar los pedidos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  const statusOptions = useMemo(() => uniqueValues(orders.map((order) => order.status)), [orders]);
  const paymentMethodOptions = useMemo(() => uniqueValues(orders.map((order) => order.payment_method)), [orders]);
  const deliveryModeOptions = useMemo(() => uniqueValues(orders.map((order) => order.delivery_mode)), [orders]);

  const filteredOrders = useMemo(
    () =>
      orders
        .filter((order) =>
          matchesOrder(order, {
            status: statusFilter,
            paymentMethod: paymentMethodFilter,
            deliveryMode: deliveryModeFilter,
            storeId: storeFilter,
            fromDate,
            toDate
          })
        )
        .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()),
    [deliveryModeFilter, fromDate, orders, paymentMethodFilter, statusFilter, storeFilter, toDate]
  );

  const filteredStore = useMemo(
    () => stores.find((store) => String(store.id) === storeFilter) ?? null,
    [storeFilter, stores]
  );
  const totalAmount = useMemo(() => filteredOrders.reduce((sum, order) => sum + (order.pricing.total ?? 0), 0), [filteredOrders]);
  const hasCustomFilters =
    statusFilter !== "" ||
    paymentMethodFilter !== "" ||
    deliveryModeFilter !== "" ||
    storeFilter !== "" ||
    fromDate !== today ||
    toDate !== today;
  const periodStats = useMemo(() => buildNamedPeriodStats(filteredOrders), [filteredOrders]);

  function countForFilter(nextFilters: OrderFilters) {
    return orders.filter((order) => matchesOrder(order, nextFilters)).length;
  }

  function resetFilters() {
    setStatusFilter("");
    setPaymentMethodFilter("");
    setDeliveryModeFilter("");
    setStoreFilter("");
    setFromDate(today);
    setToDate(today);
  }

  if (loading) return <LoadingCard />;
  if (error) return <EmptyState title="Pedidos no disponibles" description={error} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Pedidos"
        description="Filtra por comercio y cruza estados, pago, entrega y fechas con estadisticas recalculadas sobre el conjunto visible."
        action={
          <button type="button" onClick={() => void load()} className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white">
            Actualizar
          </button>
        }
      />

      <section className="rounded-[28px] border border-[#d9e6ff] bg-[#f6f9ff] p-5 text-sm text-[#38558a] shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#6a88bf]">Ayuda</p>
        <p className="mt-2 leading-7">
          Las tarjetas de arriba muestran solo el subconjunto filtrado. Si eliges un comercio, las metricas se vuelven
          especificas de esa tienda para detectar ventas, ticket y cancelaciones sin cambiar de pantalla.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Pedidos filtrados" value={String(filteredOrders.length)} description={filteredStore ? filteredStore.name : "Todos los comercios"} />
        <StatCard label="Total filtrado" value={formatCurrency(totalAmount)} description="Suma de importes del conjunto visible." />
        <StatCard label="Entregados" value={String(filteredOrders.filter((order) => order.status === "delivered").length)} description="Entregas efectivas dentro del filtro activo." />
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

      <section className="rounded-[28px] bg-white p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-4">
          <label className="space-y-1">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">Comercio</span>
            <select
              value={storeFilter}
              onChange={(event) => setStoreFilter(event.target.value)}
              className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 outline-none"
            >
              <option value="">Todos</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">Desde</span>
            <input
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(event) => {
                const nextValue = event.target.value;
                setFromDate(nextValue);
                if (toDate && nextValue > toDate) {
                  setToDate(nextValue);
                }
              }}
              className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 outline-none"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">Hasta</span>
            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(event) => {
                const nextValue = event.target.value;
                setToDate(nextValue);
                if (fromDate && nextValue < fromDate) {
                  setFromDate(nextValue);
                }
              }}
              className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 outline-none"
            />
          </label>
          {hasCustomFilters ? (
            <div className="flex items-end">
              <button
                type="button"
                onClick={resetFilters}
                className="w-full rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700"
              >
                Limpiar filtros
              </button>
            </div>
          ) : null}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Estado del pedido</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setStatusFilter("")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  statusFilter === "" ? "bg-brand-500 text-white" : "bg-zinc-100 text-zinc-700"
                }`}
              >
                Todos
              </button>
              {statusOptions.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    statusFilter === status ? "bg-brand-500 text-white" : "bg-zinc-100 text-zinc-700"
                  }`}
                >
                  {(statusLabels[status] ?? status)} ({countForFilter({ status, paymentMethod: paymentMethodFilter, deliveryMode: deliveryModeFilter, storeId: storeFilter, fromDate, toDate })})
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Tipo de pago</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethodFilter("")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  paymentMethodFilter === "" ? "bg-brand-500 text-white" : "bg-zinc-100 text-zinc-700"
                }`}
              >
                Todos
              </button>
              {paymentMethodOptions.map((paymentMethod) => (
                <button
                  key={paymentMethod}
                  type="button"
                  onClick={() => setPaymentMethodFilter(paymentMethod)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    paymentMethodFilter === paymentMethod ? "bg-brand-500 text-white" : "bg-zinc-100 text-zinc-700"
                  }`}
                >
                  {paymentMethodLabels[paymentMethod] ?? paymentMethod}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Tipo de entrega</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDeliveryModeFilter("")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  deliveryModeFilter === "" ? "bg-brand-500 text-white" : "bg-zinc-100 text-zinc-700"
                }`}
              >
                Todos
              </button>
              {deliveryModeOptions.map((deliveryMode) => (
                <button
                  key={deliveryMode}
                  type="button"
                  onClick={() => setDeliveryModeFilter(deliveryMode)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    deliveryModeFilter === deliveryMode ? "bg-brand-500 text-white" : "bg-zinc-100 text-zinc-700"
                  }`}
                >
                  {deliveryModeLabels[deliveryMode] ?? deliveryMode}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="space-y-4">
        {filteredOrders.map((order) => (
          <article key={order.id} className="rounded-[28px] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Pedido #{order.id}</p>
                <h3 className="mt-2 text-lg font-bold text-ink">{order.store_name}</h3>
                <p className="text-sm text-zinc-600">
                  {order.customer_name} | {formatDateTime(order.created_at)}
                </p>
              </div>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
                {statusLabels[order.status] ?? order.status}
              </span>
            </div>
            <div className="mt-3 grid gap-2 text-sm text-zinc-600 md:grid-cols-3 xl:grid-cols-5">
              <p>Pago: {paymentMethodLabels[order.payment_method] ?? order.payment_method}</p>
              <p>Entrega: {deliveryModeLabels[order.delivery_mode] ?? order.delivery_mode}</p>
              <p>Total: {formatCurrency(order.pricing.total)}</p>
              <p>Fee plataforma: {formatCurrency(order.service_fee)}</p>
              <p>Estado pago: {statusLabels[order.payment_status] ?? order.payment_status}</p>
              <p>Estado delivery: {statusLabels[order.delivery_status] ?? order.delivery_status}</p>
              <p>Rider: {order.assigned_rider_name ?? "Sin asignar"}</p>
              <p>Promociones: {formatCurrency(order.financial_discount_total)}</p>
              <p>Descuento comercial: {formatCurrency(order.commercial_discount_total)}</p>
            </div>
          </article>
        ))}

        {!filteredOrders.length ? (
          <EmptyState
            title="No hay pedidos para esos filtros"
            description="Ajusta el comercio, fechas o estados para volver a ver resultados."
            action={
              hasCustomFilters ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white"
                >
                  Ver todos
                </button>
              ) : undefined
            }
          />
        ) : null}
      </div>
    </div>
  );
}
