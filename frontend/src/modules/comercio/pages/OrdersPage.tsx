import { useEffect, useEffectEvent, useMemo, useRef, useState, type ReactNode } from "react";
import { EmptyState, LoadingCard, PageHeader, StatCard } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import { useMediaQuery } from "../../../shared/hooks/useMediaQuery";
import {
  assignMerchantOrderRider,
  buildMerchantSocketUrl,
  fetchMerchantOrders,
  fetchMerchantRiders,
  fetchMerchantStore,
  REALTIME_ENABLED,
  updateMerchantOrderStatus,
  updateMerchantStore
} from "../../../shared/services/api";
import { useUiStore } from "../../../shared/stores";
import type { DeliveryProfile, MerchantStore, Order, OrderStatusUpdate, StoreUpdate } from "../../../shared/types";
import { HelpTooltip } from "../../../shared/ui/HelpTooltip";
import { notifyCatalogStoresChanged } from "../../../shared/utils/catalogStores";
import { formatCurrency } from "../../../shared/utils/format";
import {
  buildNamedPeriodStats,
  groupOrdersByDate,
  isHiddenOrderByDefault
} from "../../../shared/utils/orderAnalytics";
import { playNotificationTone } from "../../../shared/utils/notificationSound";
import { statusLabels } from "../../../shared/utils/labels";
import { useMerchantMobileHeader } from "../MerchantMobileHeaderContext";
import { hasStoreAddressConfiguration, toStoreAddressFormState } from "../components/StoreAddressSection";
import { OrdersTable } from "../components/OrdersTable";
import { useMerchantStoreStatusSync } from "../hooks/useMerchantStoreStatusSync";

const LIVE_REFRESH_INTERVAL_MS = 15000;
const SOCKET_RECONNECT_DELAY_MS = 3000;

type MerchantOrderAction = Extract<
  OrderStatusUpdate["status"],
  "preparing" | "ready_for_dispatch" | "ready_for_pickup" | "delivered" | "cancelled"
>;

function toStoreUpdatePayload(store: MerchantStore): StoreUpdate {
  return {
    name: store.name,
    description: store.description,
    address: store.address,
    postal_code: store.postal_code ?? null,
    province: store.province ?? null,
    locality: store.locality ?? null,
    phone: store.phone,
    latitude: store.latitude ?? null,
    longitude: store.longitude ?? null,
    logo_url: store.logo_url ?? null,
    cover_image_url: store.cover_image_url ?? null,
    accepting_orders: store.accepting_orders,
    opening_note: store.opening_note ?? null,
    min_delivery_minutes: store.min_delivery_minutes,
    max_delivery_minutes: store.max_delivery_minutes
  };
}

function sortOrders(items: Order[]) {
  return [...items].sort((left, right) => right.id - left.id);
}

function OrdersToggleSwitch({
  acceptingOrders,
  canToggleOrders,
  savingToggle,
  onToggle,
  surface
}: {
  acceptingOrders: boolean;
  canToggleOrders: boolean;
  savingToggle: boolean;
  onToggle: () => void;
  surface: "dark" | "light";
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={acceptingOrders}
      aria-label="Recibir pedidos"
      disabled={!canToggleOrders || savingToggle}
      onClick={onToggle}
      className={[
        "relative inline-flex h-8 w-14 items-center rounded-full border transition",
        acceptingOrders
          ? "border-emerald-200/70 bg-emerald-400"
          : surface === "light"
            ? "border-black/10 bg-black/10"
            : "border-white/15 bg-white/15",
        !canToggleOrders || savingToggle ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      ].join(" ")}
    >
      <span
        className={[
          "inline-block h-6 w-6 rounded-full bg-white shadow-sm transition",
          acceptingOrders ? "translate-x-7" : "translate-x-1"
        ].join(" ")}
      />
    </button>
  );
}

function OrdersToggleControl({
  acceptingOrders,
  canToggleOrders,
  savingToggle,
  onToggle,
  layout
}: {
  acceptingOrders: boolean;
  canToggleOrders: boolean;
  savingToggle: boolean;
  onToggle: () => void;
  layout: "inline" | "stacked";
}) {
  if (layout === "inline") {
    return (
      <div className="flex items-center gap-3 rounded-[22px] border border-black/10 bg-[#fff7f1] px-3 py-2 shadow-sm">
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8f5f4e]">Recibir pedidos</span>
        <OrdersToggleSwitch
          acceptingOrders={acceptingOrders}
          canToggleOrders={canToggleOrders}
          savingToggle={savingToggle}
          onToggle={onToggle}
          surface="light"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#ffd3bf]/80">Recibir pedidos</span>
      <OrdersToggleSwitch
        acceptingOrders={acceptingOrders}
        canToggleOrders={canToggleOrders}
        savingToggle={savingToggle}
        onToggle={onToggle}
        surface="dark"
      />
    </div>
  );
}

function OrdersSalesStatusCard({
  acceptingOrders,
  toggleDescription,
  toggleError,
  control,
  className = ""
}: {
  acceptingOrders: boolean;
  toggleDescription: string;
  toggleError: string | null;
  control?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-[26px] border border-white/15 bg-white/10 p-4 backdrop-blur ${className}`.trim()}>
      <div className={`flex items-start gap-4 ${control ? "justify-between" : ""}`.trim()}>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#ffd3bf]/80">Venta</p>
          <p className="mt-2 text-lg font-bold text-white">{acceptingOrders ? "Venta habilitada" : "Venta pausada"}</p>
          <p className="mt-1 text-sm leading-6 text-white/72 md:max-w-[220px]">{toggleDescription}</p>
        </div>
        {control}
      </div>
      {toggleError ? <p className="mt-3 rounded-2xl bg-rose-500/15 px-3 py-2 text-sm text-rose-100">{toggleError}</p> : null}
    </div>
  );
}

function OrdersSalesStatusCompactSummary({
  acceptingOrders,
  toggleDescription,
  toggleError
}: {
  acceptingOrders: boolean;
  toggleDescription: string;
  toggleError: string | null;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2 text-sm leading-5 text-white/74">
        <span
          className={[
            "mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full",
            acceptingOrders ? "bg-emerald-400" : "bg-amber-300"
          ].join(" ")}
        />
        <span>
          <span className="font-semibold text-white">{acceptingOrders ? "Venta habilitada." : "Venta pausada."}</span>{" "}
          <span>{toggleDescription}</span>
        </span>
      </div>
      {toggleError ? <span className="block rounded-2xl bg-rose-500/15 px-3 py-2 text-sm text-rose-100">{toggleError}</span> : null}
    </div>
  );
}

export function OrdersPage() {
  const { token } = useAuthSession();
  const { setMobileHeaderAction } = useMerchantMobileHeader();
  const enqueueToast = useUiStore((state) => state.enqueueToast);
  const [store, setStore] = useState<MerchantStore | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [riders, setRiders] = useState<DeliveryProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingToggle, setSavingToggle] = useState(false);
  const [busyActionKey, setBusyActionKey] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [showDelivered, setShowDelivered] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const ordersRef = useRef<Order[]>([]);
  const knownOrderIdsRef = useRef<Set<number>>(new Set());
  const hasLoadedOrdersRef = useRef(false);
  const requestIdRef = useRef(0);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const isApproved = store?.status === "approved";
  const acceptingOrders = isApproved ? store?.accepting_orders ?? false : false;
  const hasConfiguredAddress = store ? hasStoreAddressConfiguration(toStoreAddressFormState(store)) : false;
  const canEnableOrders = isApproved && hasConfiguredAddress;
  const canToggleOrders = isApproved && (acceptingOrders || hasConfiguredAddress);
  const toggleDescription = !store
    ? ""
    : !isApproved
      ? "Disponible cuando el comercio quede aprobado."
      : !acceptingOrders && !hasConfiguredAddress
        ? "Configura la direccion del comercio antes de habilitar la venta."
        : acceptingOrders
          ? "El comercio figura abierto para tomar pedidos."
          : "Activalo cuando quieras volver a vender.";

  function notifyNewOrders(newOrders: Order[]) {
    if (!newOrders.length) {
      return;
    }

    const orderedNewOrders = sortOrders(newOrders);
    if (orderedNewOrders.length === 1) {
      const order = orderedNewOrders[0];
      enqueueToast(`Nuevo pedido #${order.id} de ${order.customer_name}`);
    } else {
      enqueueToast(`${orderedNewOrders.length} pedidos nuevos`);
    }
    void playNotificationTone();
  }

  function replaceOrders(nextOrders: Order[], options?: { notifyNew?: boolean }) {
    const sortedOrders = sortOrders(nextOrders);
    const newOrders = options?.notifyNew
      ? sortedOrders.filter((order) => !knownOrderIdsRef.current.has(order.id))
      : [];

    ordersRef.current = sortedOrders;
    knownOrderIdsRef.current = new Set(sortedOrders.map((order) => order.id));
    hasLoadedOrdersRef.current = true;
    setOrders(sortedOrders);

    if (newOrders.length) {
      notifyNewOrders(newOrders);
    }
  }

  function upsertOrder(nextOrder: Order, options?: { notifyNew?: boolean }) {
    const isNewOrder = !knownOrderIdsRef.current.has(nextOrder.id);
    const currentOrders = ordersRef.current;
    const existingIndex = currentOrders.findIndex((order) => order.id === nextOrder.id);
    const mergedOrders =
      existingIndex >= 0
        ? sortOrders(currentOrders.map((order) => (order.id === nextOrder.id ? nextOrder : order)))
        : sortOrders([nextOrder, ...currentOrders]);

    ordersRef.current = mergedOrders;
    knownOrderIdsRef.current = new Set(mergedOrders.map((order) => order.id));
    hasLoadedOrdersRef.current = true;
    setOrders(mergedOrders);

    if (options?.notifyNew && isNewOrder) {
      notifyNewOrders([nextOrder]);
    }
  }

  async function refreshRiders() {
    if (!token) {
      return;
    }
    const nextRiders = await fetchMerchantRiders(token);
    setRiders(nextRiders);
  }

  async function load(options?: {
    silent?: boolean;
    notifyNew?: boolean;
    includeStore?: boolean;
    includeRiders?: boolean;
  }) {
    if (!token) return;

    const requestId = ++requestIdRef.current;
    if (!options?.silent) {
      setLoading(true);
      setError(null);
    }

    try {
      const includeStore = options?.includeStore ?? true;
      const includeRiders = options?.includeRiders ?? true;
      const [storeResult, orderResults, riderResults] = await Promise.all([
        includeStore ? fetchMerchantStore(token) : Promise.resolve(null),
        fetchMerchantOrders(token),
        includeRiders ? fetchMerchantRiders(token) : Promise.resolve(null)
      ]);

      if (requestId !== requestIdRef.current) {
        return;
      }

      if (storeResult) {
        setStore(storeResult);
      }
      if (riderResults) {
        setRiders(riderResults);
      }
      replaceOrders(orderResults, { notifyNew: Boolean(options?.notifyNew && hasLoadedOrdersRef.current) });
      setError(null);
    } catch (requestError) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      if (!options?.silent) {
        setError(requestError instanceof Error ? requestError.message : "No se pudieron cargar los pedidos");
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

  useMerchantStoreStatusSync({ paused: savingToggle, store, setStore });

  useEffect(() => {
    if (!token || !REALTIME_ENABLED) return;

    let socket: WebSocket | null = null;
    let reconnectTimeoutId: number | null = null;
    let closedManually = false;

    const scheduleReconnect = () => {
      if (closedManually || reconnectTimeoutId !== null) {
        return;
      }

      reconnectTimeoutId = window.setTimeout(() => {
        reconnectTimeoutId = null;
        void load({ silent: true, notifyNew: hasLoadedOrdersRef.current, includeStore: false, includeRiders: false });
        connect();
      }, SOCKET_RECONNECT_DELAY_MS);
    };

    const connect = () => {
      if (closedManually) {
        return;
      }

      try {
        socket = new WebSocket(buildMerchantSocketUrl(token));
      } catch {
        scheduleReconnect();
        return;
      }

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (!payload?.order) {
            return;
          }
          upsertOrder(payload.order as Order, { notifyNew: payload.type === "order.created" });
        } catch {
          // Ignore malformed realtime payloads and keep HTTP refresh as fallback.
        }
      };

      socket.onerror = () => {
        socket?.close();
      };

      socket.onclose = () => {
        socket = null;
        scheduleReconnect();
      };
    };

    connect();

    return () => {
      closedManually = true;
      if (reconnectTimeoutId !== null) {
        window.clearTimeout(reconnectTimeoutId);
      }
      socket?.close();
    };
  }, [token]);

  useEffect(() => {
    if (!token) return;

    const refreshOrdersSilently = () => {
      if (hasLoadedOrdersRef.current) {
        void load({ silent: true, notifyNew: true, includeStore: false, includeRiders: false });
      }
    };

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshOrdersSilently();
      }
    }, LIVE_REFRESH_INTERVAL_MS);

    const handleFocus = () => {
      refreshOrdersSilently();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshOrdersSilently();
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

  async function handleUpdateStatus(orderId: number, status: MerchantOrderAction) {
    if (!token) return;
    setBusyActionKey(`${orderId}:${status}`);
    setActionError(null);
    try {
      const updatedOrder = await updateMerchantOrderStatus(token, orderId, { status });
      upsertOrder(updatedOrder);
      await refreshRiders();
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "No se pudo actualizar el pedido");
    } finally {
      setBusyActionKey(null);
    }
  }

  async function handleAssignRider(orderId: number, riderUserId: number) {
    if (!token) return;
    setBusyActionKey(`${orderId}:assign`);
    setActionError(null);
    try {
      const updatedOrder = await assignMerchantOrderRider(token, orderId, riderUserId);
      upsertOrder(updatedOrder);
      await refreshRiders();
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "No se pudo asignar el rider");
    } finally {
      setBusyActionKey(null);
    }
  }

  async function handleToggleAcceptingOrders() {
    if (!token || !store || !isApproved || savingToggle) return;
    if (!store.accepting_orders && !hasConfiguredAddress) {
      setToggleError(
        "Configura CP, provincia, localidad, calle, altura y geolocalizacion del local antes de habilitar la venta."
      );
      return;
    }

    const previousStore = store;
    const nextStore = { ...store, accepting_orders: !store.accepting_orders };

    setStore(nextStore);
    setToggleError(null);
    setSavingToggle(true);
    try {
      const updatedStore = await updateMerchantStore(token, toStoreUpdatePayload(nextStore));
      setStore(updatedStore);
      notifyCatalogStoresChanged();
    } catch (requestError) {
      setStore(previousStore);
      setToggleError(requestError instanceof Error ? requestError.message : "No se pudo actualizar la venta");
    } finally {
      setSavingToggle(false);
    }
  }

  const handleToggleOrdersAction = useEffectEvent(() => {
    void handleToggleAcceptingOrders();
  });

  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const order of orders) {
      counts.set(order.status, (counts.get(order.status) ?? 0) + 1);
    }
    return counts;
  }, [orders]);

  const openOrders = useMemo(() => orders.filter((order) => !isHiddenOrderByDefault(order)), [orders]);
  const filteredOrders = useMemo(
    () =>
      orders.filter((order) => {
        if (!showDelivered && order.status === "delivered") {
          return false;
        }
        if (!showCancelled && order.status === "cancelled") {
          return false;
        }
        if (statusFilter && order.status !== statusFilter) {
          return false;
        }
        return true;
      }),
    [orders, showCancelled, showDelivered, statusFilter]
  );
  const groups = useMemo(() => groupOrdersByDate(filteredOrders), [filteredOrders]);
  const periodStats = useMemo(() => buildNamedPeriodStats(filteredOrders), [filteredOrders]);
  const todayStats = periodStats.find((item) => item.key === "today")?.stats;

  useEffect(() => {
    if (isDesktop || loading || error || !store) {
      setMobileHeaderAction(null);
      return;
    }

    setMobileHeaderAction(
      <OrdersToggleControl
        acceptingOrders={acceptingOrders}
        canToggleOrders={canToggleOrders}
        savingToggle={savingToggle}
        onToggle={handleToggleOrdersAction}
        layout="inline"
      />
    );

    return () => {
      setMobileHeaderAction(null);
    };
  }, [acceptingOrders, canToggleOrders, error, isDesktop, loading, savingToggle, setMobileHeaderAction, store, handleToggleOrdersAction]);

  if (loading) return <LoadingCard />;
  if (error) return <EmptyState title="Pedidos no disponibles" description={error} />;
  if (!store) {
    return <EmptyState title="Comercio no disponible" description="No se pudo cargar la configuracion del comercio." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Comercio"
        className={isDesktop ? undefined : "p-4"}
        contentClassName={isDesktop ? undefined : "gap-3"}
        titleClassName={isDesktop ? undefined : "mt-2 text-[1.95rem]"}
        descriptionClassName={isDesktop ? undefined : "mt-2 max-w-none text-sm leading-5"}
        title={
          <span className="inline-flex items-center gap-3">
            <span>Pedidos</span>
            <HelpTooltip label="Ayuda sobre pedidos" variant="inverse">
              Revisa tus pedidos abiertos y muestra entregados o cancelados solo cuando los necesites.
            </HelpTooltip>
          </span>
        }
        description={
          isDesktop ? undefined : (
            <OrdersSalesStatusCompactSummary
              acceptingOrders={acceptingOrders}
              toggleDescription={toggleDescription}
              toggleError={toggleError}
            />
          )
        }
        action={
          isDesktop ? (
            <OrdersSalesStatusCard
              acceptingOrders={acceptingOrders}
              toggleDescription={toggleDescription}
              toggleError={toggleError}
              control={
                <OrdersToggleControl
                  acceptingOrders={acceptingOrders}
                  canToggleOrders={canToggleOrders}
                  savingToggle={savingToggle}
                  onToggle={handleToggleOrdersAction}
                  layout="stacked"
                />
              }
              className="min-w-[280px]"
            />
          ) : undefined
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Abiertos" value={String(openOrders.length)} description="Pedidos visibles para operar ahora." />
        <StatCard
          label="Hoy"
          value={formatCurrency(todayStats?.sales ?? 0)}
          description={`${todayStats?.orderCount ?? 0} pedidos dentro del filtro actual.`}
        />
        <StatCard
          label="Entregados"
          value={String(statusCounts.get("delivered") ?? 0)}
          description="Solo aparecen si activas el filtro correspondiente."
        />
        <StatCard
          label="Cancelados"
          value={String(statusCounts.get("cancelled") ?? 0)}
          description="Tambien quedan ocultos hasta que los filtres."
        />
      </div>

      {actionError ? (
        <p className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          {actionError}
        </p>
      ) : null}

      <section className="rounded-[28px] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Filtros</p>
            <div className="mt-2 flex items-center gap-2">
              <h2 className="text-xl font-bold text-ink">Filtros de pedidos</h2>
              <HelpTooltip label="Ayuda sobre filtros de pedidos">
                Usa estos filtros para mostrar solo los pedidos que quieres revisar.
              </HelpTooltip>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowDelivered((current) => !current)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                showDelivered ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-700"
              }`}
            >
              {showDelivered ? "Ocultar entregados" : `Ver entregados (${statusCounts.get("delivered") ?? 0})`}
            </button>
            <button
              type="button"
              onClick={() => setShowCancelled((current) => !current)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                showCancelled ? "bg-rose-600 text-white" : "bg-zinc-100 text-zinc-700"
              }`}
            >
              {showCancelled ? "Ocultar cancelados" : `Ver cancelados (${statusCounts.get("cancelled") ?? 0})`}
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter("")}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              statusFilter === "" ? "bg-brand-500 text-white" : "bg-zinc-100 text-zinc-700"
            }`}
          >
            Todos abiertos
          </button>
          {["created", "preparing", "ready_for_dispatch", "ready_for_pickup", "out_for_delivery"].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                statusFilter === status ? "bg-brand-500 text-white" : "bg-zinc-100 text-zinc-700"
              }`}
            >
              {(statusLabels[status] ?? status)} ({statusCounts.get(status) ?? 0})
            </button>
          ))}
        </div>
      </section>

      {groups.length ? (
        <OrdersTable
          groups={groups}
          riders={riders}
          busyActionKey={busyActionKey}
          onAssignRider={handleAssignRider}
          onUpdateStatus={handleUpdateStatus}
        />
      ) : (
        <EmptyState
          title="No hay pedidos para este filtro"
          description="Ajusta el estado o habilita entregados/cancelados para revisar otros movimientos."
        />
      )}
    </div>
  );
}
