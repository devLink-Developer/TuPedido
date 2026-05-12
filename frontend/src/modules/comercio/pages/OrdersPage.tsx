import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { EmptyState, LoadingCard } from "../../../shared/components";
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
import { hasAnyCoverageArea } from "../components/StoreCoverageSection";
import { OrdersTable } from "../components/OrdersTable";
import { useMerchantStoreStatusSync } from "../hooks/useMerchantStoreStatusSync";

const LIVE_REFRESH_INTERVAL_MS = 15000;
const SOCKET_RECONNECT_DELAY_MS = 3000;
const LEGACY_ADDRESS_COPY = "Configura la direccion del comercio antes de habilitar la venta.";
const COVERAGE_COPY = "Configura al menos una zona de alcance para envio o retiro antes de habilitar la venta.";

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

function sortRiders(items: DeliveryProfile[]) {
  return [...items].sort(
    (left, right) => Number(right.is_active) - Number(left.is_active) || left.user_id - right.user_id
  );
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
        "relative inline-flex h-7 w-12 items-center rounded border transition",
        acceptingOrders
          ? "border-emerald-200/70 bg-emerald-400"
          : surface === "light"
            ? "border-[var(--kp-stroke)] bg-[#fff3ea]"
            : "border-white/15 bg-white/15",
        !canToggleOrders || savingToggle ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      ].join(" ")}
    >
      <span
        className={[
          "inline-block h-5 w-5 rounded bg-white shadow-sm transition",
          acceptingOrders ? "translate-x-6" : "translate-x-1"
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
      <div className="flex items-center gap-2.5 rounded border border-black/10 bg-[#fff7f1] px-3 py-1.5 shadow-sm">
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
    <div className="flex flex-col items-end gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8f5f4e]">Recibir pedidos</span>
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
    <div className="space-y-1.5">
      <div className="flex items-start gap-2 text-[13px] leading-5 text-zinc-600">
        <span
          className={[
            "mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded",
            acceptingOrders ? "bg-emerald-400" : "bg-amber-300"
          ].join(" ")}
        />
        <span>
          <span className="font-semibold text-ink">{acceptingOrders ? "Venta habilitada." : "Venta pausada."}</span>{" "}
          <span>{toggleDescription}</span>
        </span>
      </div>
      {toggleError ? <span className="block rounded bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{toggleError}</span> : null}
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
  const hasConfiguredCoverage = store ? hasAnyCoverageArea(store.delivery_settings) : false;
  const canEnableOrders = isApproved && hasConfiguredAddress && hasConfiguredCoverage;
  const canToggleOrders = isApproved && (acceptingOrders || (hasConfiguredAddress && hasConfiguredCoverage));
  const toggleDescription = !store
    ? ""
    : !isApproved
      ? "Disponible cuando el comercio quede aprobado."
      : !acceptingOrders && !hasConfiguredAddress
        ? LEGACY_ADDRESS_COPY
        : !acceptingOrders && !hasConfiguredCoverage
          ? COVERAGE_COPY
        : acceptingOrders
          ? "El comercio figura abierto para tomar pedidos."
          : "Actívalo cuando quieras volver a vender.";

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

  function upsertRider(nextRider: DeliveryProfile) {
    setRiders((current) => {
      const existingIndex = current.findIndex((rider) => rider.user_id === nextRider.user_id);
      if (existingIndex >= 0) {
        return sortRiders(current.map((rider) => (rider.user_id === nextRider.user_id ? nextRider : rider)));
      }
      return sortRiders([...current, nextRider]);
    });
  }

  async function refreshRiders() {
    if (!token) {
      return;
    }
    const nextRiders = await fetchMerchantRiders(token);
    setRiders(sortRiders(nextRiders));
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
        setRiders(sortRiders(riderResults));
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
        void load({ silent: true, notifyNew: hasLoadedOrdersRef.current, includeStore: false, includeRiders: true });
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
          if (payload?.rider) {
            upsertRider(payload.rider as DeliveryProfile);
            return;
          }
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
        void load({ silent: true, notifyNew: true, includeStore: false, includeRiders: true });
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
      setActionError(requestError instanceof Error ? requestError.message : "No se pudo asignar el repartidor");
    } finally {
      setBusyActionKey(null);
    }
  }

  async function handleToggleAcceptingOrders() {
    if (!token || !store || !isApproved || savingToggle) return;
    if (!store.accepting_orders && !hasConfiguredAddress) {
      setToggleError(
        "Configura CP, provincia, localidad, calle, altura y geolocalización del local antes de habilitar la venta."
      );
      return;
    }

    if (!store.accepting_orders && !hasConfiguredCoverage) {
      setToggleError(COVERAGE_COPY);
      return;
    }
    if (!store.accepting_orders && !canEnableOrders) {
      setToggleError(COVERAGE_COPY);
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
  const actionableOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          !["cancelled", "delivered", "delivery_failed"].includes(order.status) &&
          (order.status === "created" ||
            order.status === "accepted" ||
            order.status === "preparing" ||
            order.status === "ready_for_dispatch" ||
            order.status === "ready_for_pickup")
      ),
    [orders]
  );
  const readyForDispatchCount = useMemo(
    () => orders.filter((order) => order.status === "ready_for_dispatch" || order.status === "ready_for_pickup").length,
    [orders]
  );
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
    return <EmptyState title="Comercio no disponible" description="No se pudo cargar la configuración del comercio." />;
  }

  return (
    <div className="space-y-3">
      {isDesktop ? (
        <section className="rounded border border-[var(--kp-stroke)] bg-white/94 px-3 py-2.5 shadow-sm backdrop-blur">
          <div className="grid gap-2 2xl:grid-cols-[minmax(0,1fr)_auto] 2xl:items-center">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold leading-tight text-ink">Pedidos</h1>
                <HelpTooltip label="Ayuda sobre pedidos">
                  Opera pedidos abiertos y muestra entregados o cancelados solo cuando los necesites.
                </HelpTooltip>
              </div>
              <span
                className={[
                  "inline-flex min-h-[30px] items-center gap-2 rounded border px-2.5 text-xs font-semibold",
                  acceptingOrders
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                ].join(" ")}
              >
                <span className={["h-2 w-2 rounded", acceptingOrders ? "bg-emerald-500" : "bg-amber-500"].join(" ")} />
                {acceptingOrders ? "Venta habilitada" : "Venta pausada"}
              </span>
              <p className="min-w-[220px] flex-1 truncate text-[13px] text-zinc-600">{toggleDescription}</p>
            </div>

            <div className="flex items-center gap-2 2xl:justify-end">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8f5f4e]">Recibir pedidos</span>
              <OrdersToggleSwitch
                acceptingOrders={acceptingOrders}
                canToggleOrders={canToggleOrders}
                savingToggle={savingToggle}
                onToggle={handleToggleOrdersAction}
                surface="light"
              />
            </div>
          </div>

          {toggleError ? <p className="mt-2 rounded bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{toggleError}</p> : null}

          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-[var(--kp-stroke)] pt-2">
            <span className="inline-flex min-h-[32px] items-center gap-1.5 rounded bg-[#fffaf5] px-2.5 text-xs font-semibold text-ink">
              <span className="uppercase tracking-[0.16em] text-[var(--kp-accent)]">Accionables</span>
              <span className="text-base tabular-nums">{actionableOrders.length}</span>
              <HelpTooltip label="Ayuda sobre pedidos accionables">
                Prioriza pedidos nuevos, en preparacion y listos para despacho o retiro.
              </HelpTooltip>
            </span>
            <span className="inline-flex min-h-[32px] items-center rounded bg-zinc-50 px-2.5 text-xs font-semibold text-zinc-700">
              Por aceptar {(statusCounts.get("created") ?? 0) + (statusCounts.get("accepted") ?? 0)}
            </span>
            <span className="inline-flex min-h-[32px] items-center rounded bg-zinc-50 px-2.5 text-xs font-semibold text-zinc-700">
              Listos {readyForDispatchCount}
            </span>
            <span className="inline-flex min-h-[32px] items-center rounded bg-zinc-50 px-2.5 text-xs font-semibold text-zinc-700">
              Abiertos {openOrders.length}
            </span>
            <span className="inline-flex min-h-[32px] items-center rounded bg-zinc-50 px-2.5 text-xs font-semibold text-zinc-700">
              Hoy {formatCurrency(todayStats?.sales ?? 0)}
            </span>
            <span className="inline-flex min-h-[32px] items-center rounded bg-zinc-50 px-2.5 text-xs font-semibold text-zinc-700">
              Entregados {statusCounts.get("delivered") ?? 0}
            </span>
            <span className="inline-flex min-h-[32px] items-center rounded bg-zinc-50 px-2.5 text-xs font-semibold text-zinc-700">
              Cancelados {statusCounts.get("cancelled") ?? 0}
            </span>

            <span className="ml-0 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400 xl:ml-auto">Filtros</span>
            <button
              type="button"
              onClick={() => setStatusFilter("")}
              className={`min-h-[34px] rounded px-2.5 text-xs font-semibold transition ${
                statusFilter === "" ? "bg-brand-500 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              Abiertos
            </button>
            {["created", "preparing", "ready_for_dispatch", "ready_for_pickup", "out_for_delivery"].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`min-h-[34px] rounded px-2.5 text-xs font-semibold transition ${
                  statusFilter === status ? "bg-brand-500 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                {(statusLabels[status] ?? status)} ({statusCounts.get(status) ?? 0})
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowDelivered((current) => !current)}
              className={`min-h-[34px] rounded px-2.5 text-xs font-semibold transition ${
                showDelivered ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              {showDelivered ? "Sin entregados" : `Entregados ${statusCounts.get("delivered") ?? 0}`}
            </button>
            <button
              type="button"
              onClick={() => setShowCancelled((current) => !current)}
              className={`min-h-[34px] rounded px-2.5 text-xs font-semibold transition ${
                showCancelled ? "bg-rose-600 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              {showCancelled ? "Sin cancelados" : `Cancelados ${statusCounts.get("cancelled") ?? 0}`}
            </button>
          </div>
        </section>
      ) : (
        <section className="rounded border border-black/5 bg-white/80 px-4 py-3 text-sm shadow-sm backdrop-blur">
          <OrdersSalesStatusCompactSummary
            acceptingOrders={acceptingOrders}
            toggleDescription={toggleDescription}
            toggleError={toggleError}
          />
        </section>
      )}

      {actionError ? (
        <p className="rounded border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
          {actionError}
        </p>
      ) : null}

      <section className="rounded border border-[var(--kp-stroke)] bg-white/92 px-3 py-3 shadow-sm md:hidden">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex min-h-[44px] items-center gap-2 rounded bg-[#fffaf5] px-3 text-sm font-semibold text-ink">
              <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--kp-accent)]">Operacion</span>
              <span className="text-lg tabular-nums">{actionableOrders.length}</span>
              <span className="text-xs font-medium text-zinc-500">accionables</span>
              <HelpTooltip label="Ayuda sobre pedidos accionables">
                Prioriza pedidos nuevos, en preparacion y listos para despacho o retiro.
              </HelpTooltip>
            </div>
            <span className="inline-flex min-h-[36px] items-center rounded bg-zinc-50 px-3 text-xs font-semibold text-zinc-700">
              Por aceptar {(statusCounts.get("created") ?? 0) + (statusCounts.get("accepted") ?? 0)}
            </span>
            <span className="inline-flex min-h-[36px] items-center rounded bg-zinc-50 px-3 text-xs font-semibold text-zinc-700">
              Listos {readyForDispatchCount}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Filtros</span>
            <button
              type="button"
              onClick={() => setStatusFilter("")}
              className={`min-h-[44px] rounded px-3 text-[13px] font-semibold transition ${
                statusFilter === "" ? "bg-brand-500 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              Abiertos
            </button>
            {["created", "preparing", "ready_for_dispatch", "ready_for_pickup", "out_for_delivery"].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`min-h-[44px] rounded px-3 text-[13px] font-semibold transition ${
                  statusFilter === status ? "bg-brand-500 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                {(statusLabels[status] ?? status)} ({statusCounts.get(status) ?? 0})
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowDelivered((current) => !current)}
              className={`min-h-[44px] rounded px-3 text-[13px] font-semibold transition ${
                showDelivered ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              {showDelivered ? "Sin entregados" : `Entregados ${statusCounts.get("delivered") ?? 0}`}
            </button>
            <button
              type="button"
              onClick={() => setShowCancelled((current) => !current)}
              className={`min-h-[44px] rounded px-3 text-[13px] font-semibold transition ${
                showCancelled ? "bg-rose-600 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              {showCancelled ? "Sin cancelados" : `Cancelados ${statusCounts.get("cancelled") ?? 0}`}
            </button>
          </div>
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
