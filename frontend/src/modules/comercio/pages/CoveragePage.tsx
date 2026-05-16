import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { EmptyState, LoadingCard } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import {
  fetchMerchantStore,
  geocodeAddress,
  updateMerchantDeliverySettings,
  updateMerchantStore
} from "../../../shared/services/api";
import type { MerchantStore, StoreUpdate } from "../../../shared/types";
import { Button } from "../../../shared/ui/Button";
import { buildAddressGeocodeRequest } from "../../../shared/utils/addressFields";
import {
  StoreAddressSection,
  emptyStoreAddressForm,
  hasStoreAddressConfiguration,
  toStoreAddressFormState,
  toStoreAddressPayload,
  type StoreAddressFormState
} from "../components/StoreAddressSection";
import { StoreCoverageSection, hasAnyCoverageArea, hasCoveragePolygon } from "../components/StoreCoverageSection";
import { MerchantPageBar } from "../components/MerchantPageBar";
import { useMerchantStoreStatusSync } from "../hooks/useMerchantStoreStatusSync";

function toStoreUpdatePayload(store: MerchantStore, acceptingOrders: boolean): StoreUpdate {
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
    accepting_orders: acceptingOrders,
    opening_note: store.opening_note ?? null,
    min_delivery_minutes: store.min_delivery_minutes,
    max_delivery_minutes: store.max_delivery_minutes
  };
}

function hasStoreAddressDraft(form: StoreAddressFormState) {
  return Boolean(
    form.postal_code.trim() ||
      form.province.trim() ||
      form.locality.trim() ||
      form.street_name.trim() ||
      form.street_number.trim() ||
      form.latitude.trim() ||
      form.longitude.trim()
  );
}

function buildStoreAddressSummary(form: StoreAddressFormState) {
  return {
    streetLine: [form.street_name.trim(), form.street_number.trim()].filter(Boolean).join(" "),
    locationLine: [form.locality.trim(), form.province.trim(), form.postal_code.trim()].filter(Boolean).join(" - ")
  };
}

function deliveryBlockReason(store: MerchantStore, options: { addressReady: boolean }) {
  const { addressReady } = options;
  if (!addressReady) {
    return "Configura CP, provincia, localidad, calle, altura y geolocalizacion del local antes de habilitar delivery.";
  }
  if (!hasCoveragePolygon(store.delivery_settings.delivery_area_polygon)) {
    return "Dibuja y guarda el alcance de delivery antes de habilitar envios.";
  }
  if ((store.delivery_settings.configured_riders_count ?? 0) === 0) {
    return "Configura al menos un repartidor antes de habilitar envios.";
  }
  if ((store.delivery_settings.active_riders_count ?? 0) === 0) {
    return "Activa al menos un repartidor antes de habilitar envios.";
  }
  return null;
}

function normalizeDeliveryAvailability(store: MerchantStore, addressReady: boolean): MerchantStore {
  if (!store.delivery_settings.delivery_enabled || deliveryBlockReason(store, { addressReady }) === null) {
    return store;
  }
  return {
    ...store,
    delivery_settings: {
      ...store.delivery_settings,
      delivery_enabled: false
    }
  };
}

export function CoveragePage() {
  const { token } = useAuthSession();
  const [store, setStore] = useState<MerchantStore | null>(null);
  const [storeAddressForm, setStoreAddressForm] = useState<StoreAddressFormState>(emptyStoreAddressForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddressEditor, setShowAddressEditor] = useState(false);

  const isApproved = store?.status === "approved";
  const deliveryAddressReady = hasStoreAddressConfiguration(storeAddressForm);
  const coverageReady = store ? hasAnyCoverageArea(store.delivery_settings) : false;
  const deliveryReady = store ? deliveryBlockReason(store, { addressReady: deliveryAddressReady }) === null : false;
  const deliveryUnavailableMessage = store ? deliveryBlockReason(store, { addressReady: deliveryAddressReady }) : null;
  const deliveryChecked = Boolean(store?.delivery_settings.delivery_enabled && deliveryReady);
  const hasAddressDraft = hasStoreAddressDraft(storeAddressForm);
  const addressSummary = useMemo(() => buildStoreAddressSummary(storeAddressForm), [storeAddressForm]);

  async function load() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const storeResult = await fetchMerchantStore(token);
      const nextAddressForm = toStoreAddressFormState(storeResult);
      setStore(normalizeDeliveryAvailability(storeResult, hasStoreAddressConfiguration(nextAddressForm)));
      setStoreAddressForm(nextAddressForm);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo cargar direccion y alcance");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  useMerchantStoreStatusSync({ paused: saving, store, setStore });

  function handleOpenAddressEditor() {
    setShowAddressEditor(true);
    setError(null);
  }

  function handleCancelAddressEditor() {
    if (!store) return;
    setStoreAddressForm(toStoreAddressFormState(store));
    setShowAddressEditor(false);
    setError(null);
  }

  function handleDeleteAddress() {
    setStoreAddressForm(emptyStoreAddressForm);
    setStore((current) =>
      current
        ? {
            ...current,
            address: "",
            postal_code: null,
            province: null,
            locality: null,
            latitude: null,
            longitude: null,
            accepting_orders: false,
            delivery_settings: {
              ...current.delivery_settings,
              delivery_enabled: false
            }
          }
        : current
    );
    setShowAddressEditor(false);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !store) return;
    setError(null);
    setSaving(true);

    try {
      let nextStoreAddressForm = storeAddressForm;
      const geocodeRequest = buildAddressGeocodeRequest(storeAddressForm);
      if (geocodeRequest && !hasStoreAddressConfiguration(storeAddressForm)) {
        const result = await geocodeAddress(token, geocodeRequest);
        nextStoreAddressForm = {
          ...storeAddressForm,
          latitude: result.latitude.toFixed(7),
          longitude: result.longitude.toFixed(7)
        };
        setStoreAddressForm(nextStoreAddressForm);
      }

      const nextAddressReady = hasStoreAddressConfiguration(nextStoreAddressForm);
      const deliveryReason = deliveryBlockReason(store, { addressReady: nextAddressReady });
      if (store.delivery_settings.delivery_enabled && deliveryReason) {
        setError(deliveryReason);
        return;
      }
      const deliverySettings = {
        ...store.delivery_settings,
        delivery_enabled: store.delivery_settings.delivery_enabled && deliveryReason === null
      };

      const addressPayload =
        toStoreAddressPayload(nextStoreAddressForm) ??
        (hasStoreAddressDraft(nextStoreAddressForm)
          ? {
              address: store.address,
              postal_code: store.postal_code ?? null,
              province: store.province ?? null,
              locality: store.locality ?? null,
              latitude: store.latitude ?? null,
              longitude: store.longitude ?? null
            }
          : {
              address: "",
              postal_code: null,
              province: null,
              locality: null,
              latitude: null,
              longitude: null
            });
      const nextAcceptingOrders = store.accepting_orders && nextAddressReady && hasAnyCoverageArea(deliverySettings);
      await updateMerchantStore(token, {
        ...toStoreUpdatePayload(store, nextAcceptingOrders),
        address: addressPayload.address,
        postal_code: addressPayload.postal_code,
        province: addressPayload.province,
        locality: addressPayload.locality,
        latitude: addressPayload.latitude,
        longitude: addressPayload.longitude
      });
      await updateMerchantDeliverySettings(token, deliverySettings);
      await load();
      setShowAddressEditor(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo guardar direccion y alcance");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingCard />;
  if (!store) {
    return <EmptyState title="Direccion y alcance no disponible" description={error ?? "Faltan datos del comercio"} />;
  }

  return (
    <div className="space-y-3">
      <MerchantPageBar
        eyebrow="Ajustes"
        title="Direccion y alcance"
        description="Define el punto exacto del local, las modalidades disponibles y las zonas donde el comercio puede vender."
        stats={[
          { label: "Estado", value: store.status, tone: store.status === "approved" ? "success" : "warning" },
          { label: "Direccion", value: deliveryAddressReady ? "Completa" : "Pendiente", tone: deliveryAddressReady ? "success" : "warning" },
          { label: "Zonas", value: coverageReady ? "Configuradas" : "Sin alcance", tone: coverageReady ? "success" : "warning" },
          { label: "Venta", value: store.accepting_orders ? "Activa" : "Pausada", tone: store.accepting_orders ? "success" : "neutral" }
        ]}
      />

      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3 rounded bg-white p-3 shadow-sm">
        <section className="space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Direccion del local</p>
              <h2 className="mt-1.5 text-lg font-bold text-ink">Ubicacion comercial</h2>
              <p className="mt-1.5 text-sm leading-6 text-zinc-600">
                Esta direccion se usa para validar delivery, mostrar el local y calcular si el cliente esta dentro del alcance.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {hasAddressDraft ? (
                <>
                  <Button type="button" onClick={handleOpenAddressEditor} aria-label="Editar direccion">
                    Editar direccion
                  </Button>
                  <Button type="button" onClick={handleDeleteAddress} className="bg-rose-600 shadow-none" aria-label="Eliminar direccion">
                    Eliminar direccion
                  </Button>
                </>
              ) : (
                <Button type="button" onClick={handleOpenAddressEditor} className="shadow-none" aria-label="Agregar direccion">
                  Agregar direccion
                </Button>
              )}
            </div>
          </div>

          <div className="rounded bg-zinc-50 p-3 text-sm text-zinc-600">
            {hasAddressDraft ? (
              <div className="space-y-1">
                <p className="font-semibold text-ink">{addressSummary.streetLine || "Direccion cargada"}</p>
                {addressSummary.locationLine ? <p>{addressSummary.locationLine}</p> : null}
                <p className={deliveryAddressReady ? "text-emerald-700" : "text-amber-700"}>
                  {deliveryAddressReady
                    ? "Direccion completa y geolocalizada."
                    : "Direccion incompleta. Completa calle, altura, CP, localidad y geolocalizacion para delivery."}
                </p>
              </div>
            ) : (
              <p>Sin direccion configurada. Agregala antes de habilitar pedidos.</p>
            )}
          </div>

          {showAddressEditor ? (
            <div className="rounded border border-black/10 bg-white p-3">
              <StoreAddressSection
                token={token}
                form={storeAddressForm}
                showHeader={false}
                onChange={(value) => {
                  setStoreAddressForm(value);
                  setError(null);
                }}
              />
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleCancelAddressEditor}
                  className="rounded bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Modalidades</p>
            <h2 className="mt-1.5 text-lg font-bold text-ink">Delivery y retiro</h2>
            <p className="mt-1.5 text-sm leading-6 text-zinc-600">
              Cada modalidad habilitada necesita una zona de alcance efectiva. La venta se pausa si no queda ninguna disponible.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label
              className={`flex min-h-[52px] items-center gap-2 rounded px-4 py-3 text-sm font-semibold ${
                deliveryReady ? "cursor-pointer bg-zinc-50 text-zinc-700" : "cursor-not-allowed bg-zinc-100 text-zinc-400"
              }`}
            >
              <input
                type="checkbox"
                checked={deliveryChecked}
                disabled={!deliveryReady}
                onChange={(event) => {
                  const reason = deliveryBlockReason(store, { addressReady: deliveryAddressReady });
                  if (event.target.checked && reason) {
                    setError(reason);
                    return;
                  }
                  setError(null);
                  setStore((current) =>
                    current
                      ? {
                          ...current,
                          delivery_settings: { ...current.delivery_settings, delivery_enabled: event.target.checked }
                        }
                      : current
                  );
                }}
              />
              Delivery habilitado
            </label>
            <label className="flex min-h-[52px] cursor-pointer items-center gap-2 rounded bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700">
              <input
                type="checkbox"
                checked={store.delivery_settings.pickup_enabled}
                onChange={(event) =>
                  setStore((current) =>
                    current
                      ? {
                          ...current,
                          delivery_settings: { ...current.delivery_settings, pickup_enabled: event.target.checked }
                        }
                      : current
                  )
                }
              />
              Retiro en local
            </label>
          </div>
          {!deliveryAddressReady ? (
            <p className="rounded border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
              El delivery permanece bloqueado hasta que la direccion quede configurada con CP, localidad y punto exacto en el mapa.
            </p>
          ) : null}
          {deliveryAddressReady && deliveryUnavailableMessage ? (
            <div className="rounded border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
              <p className="font-semibold">Delivery bloqueado</p>
              <p className="mt-1">{deliveryUnavailableMessage}</p>
              {(store.delivery_settings.configured_riders_count ?? 0) === 0 ||
              (store.delivery_settings.active_riders_count ?? 0) === 0 ? (
                <Link
                  to="/m/riders"
                  className="mt-3 inline-flex min-h-[44px] items-center rounded bg-amber-900 px-4 py-2 text-sm font-semibold text-white"
                >
                  Gestionar repartidores
                </Link>
              ) : null}
            </div>
          ) : null}
          {!isApproved ? (
            <p className="rounded border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
              Podras habilitar la venta desde Pedidos cuando el equipo apruebe el comercio.
            </p>
          ) : null}
        </section>

        <StoreCoverageSection
          store={store}
          onChange={(deliverySettings) =>
            setStore((current) => (current ? { ...current, delivery_settings: deliverySettings } : current))
          }
        />

        {error ? <p className="rounded bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-zinc-500">
            Guarda despues de mover el punto del mapa o editar los poligonos para actualizar el catalogo.
          </p>
          <Button type="submit" disabled={saving}>
            {saving ? "Guardando..." : "Guardar direccion y alcance"}
          </Button>
        </div>
      </form>
    </div>
  );
}
