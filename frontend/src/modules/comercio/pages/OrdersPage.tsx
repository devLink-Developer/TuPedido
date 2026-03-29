import { useEffect, useState } from "react";
import { EmptyState, LoadingCard, PageHeader } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import {
  fetchMerchantOrders,
  fetchMerchantStore,
  updateMerchantOrderStatus,
  updateMerchantStore
} from "../../../shared/services/api";
import type { MerchantStore, Order, StoreUpdate } from "../../../shared/types";
import { orderStatusOptions } from "../../../shared/utils/labels";
import { hasStoreAddressConfiguration, toStoreAddressFormState } from "../components/StoreAddressSection";
import { OrdersTable } from "../components/OrdersTable";

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

export function OrdersPage() {
  const { token } = useAuthSession();
  const [store, setStore] = useState<MerchantStore | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingToggle, setSavingToggle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

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

  async function load() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [storeResult, orderResults] = await Promise.all([fetchMerchantStore(token), fetchMerchantOrders(token)]);
      setStore(storeResult);
      setOrders(orderResults);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudieron cargar los pedidos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  async function handleUpdateStatus(orderId: number, status: (typeof orderStatusOptions)[number]) {
    if (!token) return;
    await updateMerchantOrderStatus(token, orderId, { status });
    await load();
  }

  async function handleToggleAcceptingOrders() {
    if (!token || !store || !isApproved || savingToggle) return;
    if (!store.accepting_orders && !hasConfiguredAddress) {
      setToggleError("Configura CP, provincia, localidad, calle, altura y geolocalizacion del local antes de habilitar la venta.");
      return;
    }

    const previousStore = store;
    const nextStore = { ...store, accepting_orders: !store.accepting_orders };

    setStore(nextStore);
    setToggleError(null);
    setSavingToggle(true);
    try {
      setStore(await updateMerchantStore(token, toStoreUpdatePayload(nextStore)));
    } catch (requestError) {
      setStore(previousStore);
      setToggleError(requestError instanceof Error ? requestError.message : "No se pudo actualizar la venta");
    } finally {
      setSavingToggle(false);
    }
  }

  if (loading) return <LoadingCard />;
  if (error) return <EmptyState title="Pedidos no disponibles" description={error} />;
  if (!store) {
    return <EmptyState title="Comercio no disponible" description="No se pudo cargar la configuracion del comercio." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Comercio"
        title="Pedidos"
        description="Gestion diaria de estados operativos y control de venta del comercio."
        action={
          <div className="min-w-[280px] rounded-[26px] border border-white/15 bg-white/10 p-4 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#ffd3bf]/80">Venta</p>
                <p className="mt-2 text-lg font-bold text-white">
                  {acceptingOrders ? "Venta habilitada" : "Venta pausada"}
                </p>
                <p className="mt-1 max-w-[220px] text-sm leading-6 text-white/72">{toggleDescription}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#ffd3bf]/80">
                  Recibir pedidos
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={acceptingOrders}
                  aria-label="Recibir pedidos"
                  disabled={!canToggleOrders || savingToggle}
                  onClick={() => void handleToggleAcceptingOrders()}
                  className={[
                    "relative inline-flex h-8 w-14 items-center rounded-full border transition",
                    acceptingOrders ? "border-emerald-200/70 bg-emerald-400" : "border-white/15 bg-white/15",
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
                <span className="text-xs text-white/60">
                  {savingToggle
                    ? "Guardando..."
                    : !isApproved
                      ? "Pendiente de aprobacion"
                      : !acceptingOrders && !canEnableOrders
                        ? "Completa la direccion"
                        : "Disponible ahora"}
                </span>
              </div>
            </div>
            {toggleError ? (
              <p className="mt-3 rounded-2xl bg-rose-500/15 px-3 py-2 text-sm text-rose-100">{toggleError}</p>
            ) : null}
          </div>
        }
      />
      {orders.length ? (
        <OrdersTable orders={orders} onUpdateStatus={handleUpdateStatus} />
      ) : (
        <EmptyState title="Sin pedidos" description="Los pedidos del comercio apareceran aqui." />
      )}
    </div>
  );
}
