import { CalendarDays, CheckCircle2, ChevronRight, Package, RotateCcw, SlidersHorizontal, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EmptyState, LoadingCard, PageHeader, StatusPill } from "../../../shared/components";
import { useAuthSession, useCart } from "../../../shared/hooks";
import { fetchOrders } from "../../../shared/services/api";
import { useUiStore } from "../../../shared/stores";
import type { Order } from "../../../shared/types";
import { formatCurrency, formatDateTime } from "../../../shared/utils/format";
import { paymentMethodLabels, statusLabels } from "../../../shared/utils/labels";
import { sortOrdersByNewest } from "../orders";
import { repeatOrderIntoCart, repeatOrderMessage } from "../repeatOrder";

function formatDeliveryModeLabel(order: Order) {
  return order.delivery_mode === "delivery" ? "Envio" : "Retiro";
}

type StatusFilter = "all" | "delivered" | "cancelled";
type PeriodFilter = "all" | "30" | "90";

const periodLabels: Record<PeriodFilter, string> = {
  all: "Todo",
  "30": "Ultimos 30 dias",
  "90": "Ultimos 90 dias"
};

const statusFilterLabels: Record<StatusFilter, string> = {
  all: "Todos",
  delivered: "Entregados",
  cancelled: "Cancelados"
};

function getOrderItemCount(order: Order) {
  return order.items.reduce((total, item) => total + item.quantity, 0);
}

function matchesStatusFilter(order: Order, statusFilter: StatusFilter) {
  if (statusFilter === "all") return true;
  if (statusFilter === "delivered") return order.status === "delivered";
  return order.status === "cancelled" || order.status === "delivery_failed";
}

function matchesPeriodFilter(order: Order, periodFilter: PeriodFilter) {
  if (periodFilter === "all") return true;
  const createdAt = new Date(order.created_at).getTime();
  if (Number.isNaN(createdAt)) return true;
  const days = Number(periodFilter);
  const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
  return createdAt >= threshold;
}

function getStatusAccent(status: string) {
  if (status === "delivered") {
    return {
      icon: CheckCircle2,
      className: "border-emerald-200 bg-emerald-50 text-emerald-700"
    };
  }

  if (status === "cancelled" || status === "delivery_failed") {
    return {
      icon: XCircle,
      className: "border-rose-200 bg-rose-50 text-rose-700"
    };
  }

  return {
    icon: Package,
    className: "border-[var(--kp-stroke)] bg-[var(--kp-accent-soft)] text-[var(--kp-accent)]"
  };
}

export function OrdersPage() {
  const navigate = useNavigate();
  const { token } = useAuthSession();
  const { addItem, setDeliveryMode } = useCart();
  const enqueueToast = useUiStore((state) => state.enqueueToast);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [repeatingOrderId, setRepeatingOrderId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [draftStatusFilter, setDraftStatusFilter] = useState<StatusFilter>("all");
  const [draftPeriodFilter, setDraftPeriodFilter] = useState<PeriodFilter>("all");

  useEffect(() => {
    if (!token) {
      setOrders([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchOrders(token)
      .then((items) => {
        if (!cancelled) {
          setOrders([...items].sort(sortOrdersByNewest));
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "No se pudieron cargar tus pedidos");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const deliveredCount = useMemo(() => orders.filter((order) => order.status === "delivered").length, [orders]);
  const cancelledCount = useMemo(
    () => orders.filter((order) => order.status === "cancelled" || order.status === "delivery_failed").length,
    [orders]
  );
  const hasActiveFilters = statusFilter !== "all" || periodFilter !== "all";
  const filteredOrders = useMemo(
    () =>
      orders.filter(
        (order) => matchesStatusFilter(order, statusFilter) && matchesPeriodFilter(order, periodFilter)
      ),
    [orders, periodFilter, statusFilter]
  );

  function openFilters() {
    setDraftStatusFilter(statusFilter);
    setDraftPeriodFilter(periodFilter);
    setFiltersOpen(true);
  }

  function applyFilters() {
    setStatusFilter(draftStatusFilter);
    setPeriodFilter(draftPeriodFilter);
    setFiltersOpen(false);
  }

  function resetFilters() {
    setDraftStatusFilter("all");
    setDraftPeriodFilter("all");
    setStatusFilter("all");
    setPeriodFilter("all");
  }

  async function repeatOrder(order: Order) {
    setRepeatingOrderId(order.id);
    try {
      const result = await repeatOrderIntoCart(order, { addItem, setDeliveryMode });
      enqueueToast(repeatOrderMessage(result), { durationMs: result.addedItemCount > 0 ? 4200 : 5200 });
      if (result.addedItemCount > 0) {
        navigate("/c/carrito");
      }
    } finally {
      setRepeatingOrderId(null);
    }
  }

  return (
    <div className="space-y-5 pb-24">
      <PageHeader
        eyebrow="Cliente"
        title="Mis pedidos"
        description="Revisa tus pedidos activos y el historial completo de entregados o cancelados."
      />

      {loading ? <LoadingCard /> : null}
      {error ? <EmptyState title="No se pudieron cargar tus pedidos" description={error} /> : null}

      {!loading && !error ? (
        orders.length ? (
          <>
            <div className="hide-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              <button
                type="button"
                onClick={openFilters}
                aria-expanded={filtersOpen}
                className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-extrabold transition ${
                  hasActiveFilters || filtersOpen
                    ? "border-[var(--kp-accent)] bg-[var(--kp-accent-soft)] text-[var(--kp-accent)]"
                    : "border-[var(--kp-stroke)] bg-white/90 text-[var(--kp-ink-strong)]"
                }`}
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                Filtros
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter(statusFilter === "delivered" ? "all" : "delivered")}
                className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-bold transition ${
                  statusFilter === "delivered"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-[var(--kp-stroke)] bg-white/90 text-[var(--kp-ink-strong)]"
                }`}
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Entregados
                <span className="text-xs text-[var(--kp-ink-muted)]">{deliveredCount}</span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter(statusFilter === "cancelled" ? "all" : "cancelled")}
                className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-bold transition ${
                  statusFilter === "cancelled"
                    ? "border-rose-300 bg-rose-50 text-rose-700"
                    : "border-[var(--kp-stroke)] bg-white/90 text-[var(--kp-ink-strong)]"
                }`}
              >
                <XCircle className="h-4 w-4" aria-hidden="true" />
                Cancelados
                <span className="text-xs text-[var(--kp-ink-muted)]">{cancelledCount}</span>
              </button>
              <button
                type="button"
                onClick={openFilters}
                className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-bold transition ${
                  periodFilter !== "all"
                    ? "border-[var(--kp-accent)] bg-[var(--kp-accent-soft)] text-[var(--kp-accent)]"
                    : "border-[var(--kp-stroke)] bg-white/90 text-[var(--kp-ink-strong)]"
                }`}
              >
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                {periodLabels[periodFilter]}
              </button>
            </div>

            {filtersOpen ? (
              <section className="kp-client-panel space-y-5 p-4 sm:p-5" aria-label="Filtros de pedidos">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-black tracking-tight text-[var(--kp-ink-strong)]">Filtrar pedidos</h2>
                    <p className="mt-1 text-sm leading-6 text-[var(--kp-ink-soft)]">
                      Ajusta el periodo y estado para encontrar pedidos anteriores.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(false)}
                    className="min-h-[44px] rounded-full px-3 text-sm font-bold text-[var(--kp-ink-soft)] transition hover:bg-[var(--kp-surface-muted)]"
                  >
                    Cerrar
                  </button>
                </div>

                <fieldset className="space-y-3">
                  <legend className="text-xs font-extrabold uppercase tracking-[0.2em] text-[var(--kp-ink-muted)]">
                    Periodo
                  </legend>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {(Object.keys(periodLabels) as PeriodFilter[]).map((value) => (
                      <label
                        key={value}
                        className={`flex min-h-[48px] items-center gap-3 rounded border px-3 text-sm font-bold transition ${
                          draftPeriodFilter === value
                            ? "border-[var(--kp-accent)] bg-[var(--kp-accent-soft)] text-[var(--kp-accent)]"
                            : "border-[var(--kp-stroke)] bg-white text-[var(--kp-ink-strong)]"
                        }`}
                      >
                        <input
                          type="radio"
                          name="orders-period"
                          value={value}
                          checked={draftPeriodFilter === value}
                          onChange={() => setDraftPeriodFilter(value)}
                          className="h-4 w-4 accent-[var(--kp-accent)]"
                        />
                        {periodLabels[value]}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="space-y-3">
                  <legend className="text-xs font-extrabold uppercase tracking-[0.2em] text-[var(--kp-ink-muted)]">
                    Estado
                  </legend>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {(Object.keys(statusFilterLabels) as StatusFilter[]).map((value) => (
                      <label
                        key={value}
                        className={`flex min-h-[48px] items-center gap-3 rounded border px-3 text-sm font-bold transition ${
                          draftStatusFilter === value
                            ? "border-[var(--kp-accent)] bg-[var(--kp-accent-soft)] text-[var(--kp-accent)]"
                            : "border-[var(--kp-stroke)] bg-white text-[var(--kp-ink-strong)]"
                        }`}
                      >
                        <input
                          type="radio"
                          name="orders-status"
                          value={value}
                          checked={draftStatusFilter === value}
                          onChange={() => setDraftStatusFilter(value)}
                          className="h-4 w-4 accent-[var(--kp-accent)]"
                        />
                        {statusFilterLabels[value]}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                  <button type="button" onClick={applyFilters} className="app-button min-h-[48px] px-5 py-3 text-sm">
                    Aplicar
                  </button>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="kp-soft-action min-h-[48px] px-5 py-3 text-sm"
                  >
                    Limpiar
                  </button>
                </div>
              </section>
            ) : null}

            {filteredOrders.length ? (
              <div className="space-y-3">
                {filteredOrders.map((order) => {
                  const statusAccent = getStatusAccent(order.status);
                  const StatusIcon = statusAccent.icon;
                  const itemCount = getOrderItemCount(order);

                  return (
                    <article
                      key={order.id}
                      className="kp-client-panel overflow-hidden transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-[rgba(255,106,26,0.28)]"
                    >
                      <Link to={`/c/pedido/${order.id}`} className="block p-4 sm:p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-full border px-3 text-xs font-extrabold ${statusAccent.className}`}
                              >
                                <StatusIcon className="h-4 w-4" aria-hidden="true" />
                                {statusLabels[order.status] ?? order.status}
                              </span>
                              <span className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full bg-[var(--kp-surface-muted)] px-3 text-xs font-bold text-[var(--kp-ink-soft)]">
                                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                                {formatDateTime(order.created_at)}
                              </span>
                            </div>
                            <h2 className="mt-3 truncate text-xl font-black tracking-tight text-[var(--kp-ink-strong)]">
                              {order.store_name}
                            </h2>
                            <p className="mt-1 text-sm font-semibold text-[var(--kp-ink-soft)]">Pedido #{order.id}</p>
                          </div>
                          <ChevronRight className="mt-2 h-5 w-5 shrink-0 text-[var(--kp-ink-muted)]" aria-hidden="true" />
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                          <div className="min-w-0">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--kp-ink-muted)]">
                              Total
                            </p>
                            <p className="mt-1 truncate font-black text-[var(--kp-ink-strong)]">
                              {formatCurrency(order.total)}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--kp-ink-muted)]">
                              Productos
                            </p>
                            <p className="mt-1 truncate font-bold text-[var(--kp-ink-strong)]">
                              {itemCount} {itemCount === 1 ? "producto" : "productos"}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--kp-ink-muted)]">
                              Entrega
                            </p>
                            <p className="mt-1 truncate font-bold text-[var(--kp-ink-strong)]">
                              {formatDeliveryModeLabel(order)}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--kp-ink-muted)]">
                              Pago
                            </p>
                            <p className="mt-1 truncate font-bold text-[var(--kp-ink-strong)]">
                              {paymentMethodLabels[order.payment_method]}
                            </p>
                          </div>
                        </div>
                      </Link>

                      <div className="flex flex-col gap-3 border-t border-[var(--kp-stroke)] bg-white/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                        <div className="flex flex-wrap gap-2">
                          <StatusPill value={order.payment_status} />
                          <span className="inline-flex min-h-[30px] items-center rounded-full bg-[var(--kp-surface-muted)] px-3 text-xs font-bold text-[var(--kp-ink-soft)]">
                            {statusLabels[order.payment_status] ?? order.payment_status}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => void repeatOrder(order)}
                          disabled={repeatingOrderId === order.id}
                          className="kp-soft-action min-h-[44px] w-full px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                        >
                          <RotateCcw className="h-4 w-4" aria-hidden="true" />
                          {repeatingOrderId === order.id ? "Actualizando precios" : "Repetir"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="No hay pedidos con esos filtros"
                description="Prueba cambiar el periodo o el estado para ampliar el historial."
              />
            )}
          </>
        ) : (
          <EmptyState
            title="Todavia no tienes pedidos"
            description="Cuando confirmes una compra aparecera aqui. El tracking solo se muestra mientras el pedido este activo."
          />
        )
      ) : null}
    </div>
  );
}
