import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { EmptyState, ImageAssetField, LoadingCard, PageHeader, PlatformWordmark, RubroChip, StatusPill } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import {
  createMerchantProductCategory,
  createMerchantProductSubcategory,
  deleteMerchantProductCategory,
  deleteMerchantProductSubcategory,
  disconnectMerchantMercadoPago,
  fetchMerchantMercadoPagoConnectUrl,
  fetchMerchantProductCategories,
  fetchMerchantStore,
  geocodeAddress,
  updateMerchantProductCategory,
  updateMerchantProductSubcategory,
  updateMerchantDeliverySettings,
  updateMerchantPaymentSettings,
  updateMerchantStore,
  updateMerchantStoreCategories
} from "../../../shared/services/api";
import { useCategoryStore } from "../../../shared/stores";
import type { MerchantStore, ProductCategory } from "../../../shared/types";
import { Button } from "../../../shared/ui/Button";
import { buildAddressGeocodeRequest } from "../../../shared/utils/addressFields";
import { deriveMercadoPagoState } from "../../../shared/utils/mercadopago";
import {
  StoreAddressSection,
  emptyStoreAddressForm,
  hasStoreAddressConfiguration,
  toStoreAddressFormState,
  toStoreAddressPayload,
  type StoreAddressFormState
} from "../components/StoreAddressSection";
import { useMerchantStoreStatusSync } from "../hooks/useMerchantStoreStatusSync";

const storeStatusMessages: Record<string, string> = {
  pending_review:
    "Tu solicitud está en revisión. Ya puedes preparar catálogo, pagos e imágenes, pero el local seguirá cerrado hasta la aprobación.",
  approved: "Tu comercio ya puede operar normalmente. Activa la recepción de pedidos cuando estés listo.",
  rejected: "La solicitud fue rechazada. Revisa tus datos y actualiza la configuración antes de volver a solicitar aprobación.",
  suspended: "Tu operación está suspendida temporalmente. Puedes revisar la configuración, pero no recibir pedidos."
};

const mercadopagoConnectionMessages: Record<string, string> = {
  connected: "Tu cuenta ya esta vinculada y lista para cobrar con split por comercio.",
  onboarding_pending: "La cuenta esta vinculada, pero falta completar el onboarding de Mercado Pago.",
  reconnect_required: "La vinculacion necesita renovarse. Desconecta y vuelve a conectar tu cuenta para seguir cobrando.",
  disconnected: "Conecta tu cuenta para aceptar pagos online desde tu propio usuario de Mercado Pago."
};

const mercadopagoConnectionLabels: Record<string, string> = {
  connected: "Conectado",
  onboarding_pending: "Onboarding pendiente",
  reconnect_required: "Reconexión requerida",
  disconnected: "No conectado"
};

function toNumber(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

type CategoryFormState = {
  name: string;
  sort_order: string;
};

type SubcategoryDraftState = {
  name: string;
  sort_order: string;
  editingId: number | null;
};

const emptyCategoryForm: CategoryFormState = {
  name: "",
  sort_order: "0"
};

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

function emptySubcategoryDraft(): SubcategoryDraftState {
  return {
    name: "",
    sort_order: "0",
    editingId: null
  };
}

export function SettingsPage() {
  const { token } = useAuthSession();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const categories = useCategoryStore((state) => state.categories);
  const categoryLoading = useCategoryStore((state) => state.loading);
  const loadCategories = useCategoryStore((state) => state.loadCategories);
  const [store, setStore] = useState<MerchantStore | null>(null);
  const [storeAddressForm, setStoreAddressForm] = useState<StoreAddressFormState>(emptyStoreAddressForm);
  const [productCategories, setProductCategories] = useState<ProductCategory[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [taxonomySaving, setTaxonomySaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taxonomyError, setTaxonomyError] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(emptyCategoryForm);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [subcategoryDrafts, setSubcategoryDrafts] = useState<Record<number, SubcategoryDraftState>>({});
  const [showIdentityEditor, setShowIdentityEditor] = useState(false);
  const [showAddressEditor, setShowAddressEditor] = useState(false);
  const [mercadoPagoAction, setMercadoPagoAction] = useState<"connect" | "disconnect" | null>(null);
  const [mercadoPagoActionError, setMercadoPagoActionError] = useState<string | null>(null);
  const [mercadopagoOAuthResult, setMercadopagoOAuthResult] = useState<{
    status: string;
    detail: string | null;
  } | null>(null);

  const isApproved = store?.status === "approved";
  const canToggleOrders = isApproved;
  const deliveryAddressReady = hasStoreAddressConfiguration(storeAddressForm);
  const hasAddressDraft = hasStoreAddressDraft(storeAddressForm);
  const addressSummary = useMemo(() => buildStoreAddressSummary(storeAddressForm), [storeAddressForm]);
  const statusMessage = useMemo(() => {
    if (!store) return "";
    return storeStatusMessages[store.status] ?? "Actualiza la información de tu negocio y mantente listo para operar.";
  }, [store]);
  const mercadopagoOAuthStatus = mercadopagoOAuthResult?.status;
  const mercadopagoOAuthDetail = mercadopagoOAuthResult?.detail;
  const mercadopagoProviderEnabled = store?.payment_settings.mercadopago_provider_enabled ?? false;
  const mercadopagoProviderMode = store?.payment_settings.mercadopago_provider_mode ?? "sandbox";
  const mercadopagoState = useMemo(
    () => (store ? deriveMercadoPagoState(store.payment_settings) : null),
    [store]
  );
  const mercadopagoConnectionStatus = mercadopagoState?.status ?? "disconnected";
  const mercadopagoReconnectRequired = mercadopagoConnectionStatus === "reconnect_required";
  const mercadopagoConnected = mercadopagoConnectionStatus === "connected";
  const mercadopagoHasAccount = mercadopagoConnectionStatus !== "disconnected";
  const mercadopagoCanOperate = Boolean(mercadopagoState?.canOperate);
  const mercadopagoModeLabel = mercadopagoProviderMode === "production" ? "Producción" : "Sandbox";
  const mercadopagoMpUserId = store?.payment_settings.mercadopago_mp_user_id;
  const mercadopagoOnboardingCompleted = Boolean(store?.payment_settings.mercadopago_onboarding_completed);
  const mercadopagoBanner = useMemo(() => {
    if (mercadopagoOAuthStatus === "connected") {
      return {
        className: "rounded border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-950",
        message: "La cuenta de Mercado Pago quedó conectada correctamente."
      };
    }
    if (mercadopagoOAuthStatus === "error") {
      return {
        className: "rounded border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-900",
        message: mercadopagoOAuthDetail || "No se pudo completar la conexión con Mercado Pago."
      };
    }
    return null;
  }, [mercadopagoOAuthDetail, mercadopagoOAuthStatus]);

  async function load() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [storeResult, , productCategoryResult] = await Promise.all([
        fetchMerchantStore(token),
        loadCategories(),
        fetchMerchantProductCategories(token)
      ]);
      setStore(storeResult);
      setStoreAddressForm(toStoreAddressFormState(storeResult));
      setProductCategories(productCategoryResult);
      setSelectedCategoryIds(storeResult.category_ids ?? []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo cargar la configuración");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  useEffect(() => {
    const status = searchParams.get("mercadopago_oauth");
    if (!status) {
      return;
    }

    setMercadopagoOAuthResult({
      status,
      detail: searchParams.get("detail")
    });

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("mercadopago_oauth");
    nextParams.delete("detail");
    const nextSearch = nextParams.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
        hash: location.hash
      },
      { replace: true }
    );
  }, [location.hash, location.pathname, navigate, searchParams]);

  useMerchantStoreStatusSync({ paused: saving || taxonomySaving, store, setStore });

  function resetCategoryEditor() {
    setEditingCategoryId(null);
    setCategoryForm(emptyCategoryForm);
  }

  function setSubcategoryDraft(categoryId: number, next: Partial<SubcategoryDraftState>) {
    setSubcategoryDrafts((current) => ({
      ...current,
      [categoryId]: { ...(current[categoryId] ?? emptySubcategoryDraft()), ...next }
    }));
  }

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
    if (!selectedCategoryIds.length) {
      setError("Seleccioná al menos un rubro para tu comercio.");
      return;
    }
    if (store.max_delivery_minutes < store.min_delivery_minutes) {
      setError("El tiempo máximo de entrega debe ser mayor o igual al mínimo.");
      return;
    }
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

      if (store.delivery_settings.delivery_enabled && !hasStoreAddressConfiguration(nextStoreAddressForm)) {
        setError("Configura la dirección completa del local y su geolocalización antes de habilitar delivery.");
        return;
      }
      const nextMercadoPagoEnabled = mercadopagoCanOperate ? store.payment_settings.mercadopago_enabled : false;
      if (!store.payment_settings.cash_enabled && !nextMercadoPagoEnabled) {
        setError("Deja al menos un medio de cobro activo: efectivo o Mercado Pago operativo.");
        return;
      }

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
      await updateMerchantStore(token, {
        name: store.name,
        description: store.description,
        address: addressPayload.address,
        postal_code: addressPayload.postal_code,
        province: addressPayload.province,
        locality: addressPayload.locality,
        phone: store.phone,
        latitude: addressPayload.latitude,
        longitude: addressPayload.longitude,
        logo_url: store.logo_url,
        cover_image_url: store.cover_image_url,
        accepting_orders: canToggleOrders ? store.accepting_orders : false,
        opening_note: store.opening_note,
        min_delivery_minutes: store.min_delivery_minutes,
        max_delivery_minutes: store.max_delivery_minutes
      });
      await updateMerchantStoreCategories(token, { category_ids: selectedCategoryIds });
      await updateMerchantDeliverySettings(token, store.delivery_settings);
      await updateMerchantPaymentSettings(token, {
        cash_enabled: store.payment_settings.cash_enabled,
        mercadopago_enabled: nextMercadoPagoEnabled
      });
      await load();
      setShowAddressEditor(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo guardar la configuración");
    } finally {
      setSaving(false);
    }
  }

  async function handleMercadoPagoConnect() {
    if (!token) return;
    setMercadoPagoAction("connect");
    setMercadoPagoActionError(null);
    try {
      const response = await fetchMerchantMercadoPagoConnectUrl(token);
      window.location.assign(response.connect_url);
    } catch (requestError) {
      setMercadoPagoActionError(
        requestError instanceof Error ? requestError.message : "No se pudo iniciar la conexión con Mercado Pago"
      );
      setMercadoPagoAction(null);
    }
  }

  async function handleMercadoPagoDisconnect() {
    if (!token) return;
    if (!window.confirm("Desconectar Mercado Pago deshabilitará los cobros online hasta volver a conectar la cuenta. ¿Continuar?")) {
      return;
    }
    setMercadoPagoAction("disconnect");
    setMercadoPagoActionError(null);
    try {
      await disconnectMerchantMercadoPago(token);
      await load();
    } catch (requestError) {
      setMercadoPagoActionError(
        requestError instanceof Error ? requestError.message : "No se pudo desconectar la cuenta de Mercado Pago"
      );
    } finally {
      setMercadoPagoAction(null);
    }
  }

  async function handleCategorySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    if (!categoryForm.name.trim()) {
      setTaxonomyError("Ingresa un nombre para la categoría.");
      return;
    }

    setTaxonomySaving(true);
    setTaxonomyError(null);
    try {
      const payload = {
        name: categoryForm.name.trim(),
        sort_order: toNumber(categoryForm.sort_order)
      };
      if (editingCategoryId) {
        await updateMerchantProductCategory(token, editingCategoryId, payload);
      } else {
        await createMerchantProductCategory(token, payload);
      }
      resetCategoryEditor();
      await load();
    } catch (requestError) {
      setTaxonomyError(requestError instanceof Error ? requestError.message : "No se pudo guardar la categoría");
    } finally {
      setTaxonomySaving(false);
    }
  }

  async function handleDeleteCategory(categoryId: number) {
    if (!token) return;
    setTaxonomySaving(true);
    setTaxonomyError(null);
    try {
      await deleteMerchantProductCategory(token, categoryId);
      if (editingCategoryId === categoryId) {
        resetCategoryEditor();
      }
      setSubcategoryDrafts((current) => {
        const next = { ...current };
        delete next[categoryId];
        return next;
      });
      await load();
    } catch (requestError) {
      setTaxonomyError(requestError instanceof Error ? requestError.message : "No se pudo eliminar la categoría");
    } finally {
      setTaxonomySaving(false);
    }
  }

  async function handleSubcategorySubmit(event: FormEvent<HTMLFormElement>, categoryId: number) {
    event.preventDefault();
    if (!token) return;
    const draft = subcategoryDrafts[categoryId] ?? emptySubcategoryDraft();
    if (!draft.name.trim()) {
      setTaxonomyError("Ingresa un nombre para la subcategoría.");
      return;
    }

    setTaxonomySaving(true);
    setTaxonomyError(null);
    try {
      const payload = {
        product_category_id: categoryId,
        name: draft.name.trim(),
        sort_order: toNumber(draft.sort_order)
      };
      if (draft.editingId) {
        await updateMerchantProductSubcategory(token, draft.editingId, payload);
      } else {
        await createMerchantProductSubcategory(token, payload);
      }
      setSubcategoryDraft(categoryId, emptySubcategoryDraft());
      await load();
    } catch (requestError) {
      setTaxonomyError(requestError instanceof Error ? requestError.message : "No se pudo guardar la subcategoría");
    } finally {
      setTaxonomySaving(false);
    }
  }

  async function handleDeleteSubcategory(subcategoryId: number, categoryId: number) {
    if (!token) return;
    setTaxonomySaving(true);
    setTaxonomyError(null);
    try {
      await deleteMerchantProductSubcategory(token, subcategoryId);
      const draft = subcategoryDrafts[categoryId];
      if (draft?.editingId === subcategoryId) {
        setSubcategoryDraft(categoryId, emptySubcategoryDraft());
      }
      await load();
    } catch (requestError) {
      setTaxonomyError(requestError instanceof Error ? requestError.message : "No se pudo eliminar la subcategoría");
    } finally {
      setTaxonomySaving(false);
    }
  }

  if (loading || categoryLoading) return <LoadingCard />;
  if (!store) {
    return <EmptyState title="Configuración no disponible" description={error ?? "Faltan datos del comercio"} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ajustes"
        title="Configura tu local"
        description="Agrupa identidad, ubicación, delivery, pagos y categorías. Si tu alta aún está en revisión, el panel queda listo pero la operación sigue cerrada."
      />

      <section className="rounded border border-black/5 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Estado de alta</p>
            <div className="mt-2">
              <StatusPill value={store.status} />
            </div>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-zinc-600">{statusMessage}</p>
        </div>
      </section>

      {mercadopagoBanner ? (
        <p className={mercadopagoBanner.className}>
          {mercadopagoBanner.message}
          {mercadopagoOAuthStatus === "connected" ? (
            <span className="sr-only">La cuenta de Mercado Pago quedo conectada correctamente.</span>
          ) : null}
        </p>
      ) : null}

      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5 rounded bg-white p-5 shadow-sm">
        <section className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Datos del local</p>
              <h2 className="mt-2 text-xl font-bold text-ink">Identidad comercial</h2>
              <p className="mt-2 text-sm text-zinc-600">
                Abre este bloque solo cuando necesites editar nombre, teléfono o descripción visible del comercio.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => setShowIdentityEditor((current) => !current)}
                className={showIdentityEditor ? "shadow-none" : ""}
              >
                {showIdentityEditor ? "Cerrar identidad" : "Editar identidad"}
              </Button>
            </div>
          </div>

          <div className="rounded bg-zinc-50 p-4 text-sm text-zinc-600">
            <p className="font-semibold text-ink">{store.name}</p>
            <p className="mt-1">{store.phone || "Sin teléfono cargado"}</p>
            <p className="mt-2">
              {store.description?.trim() || "Agrega una descripción breve para explicar qué hace especial a tu negocio."}
            </p>
          </div>

          {showIdentityEditor ? (
            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={store.name}
                onChange={(event) => setStore((current) => (current ? { ...current, name: event.target.value } : current))}
                placeholder="Nombre del local"
                className="rounded border border-black/10 bg-zinc-50 px-4 py-3"
              />
              <input
                value={store.phone}
                onChange={(event) => setStore((current) => (current ? { ...current, phone: event.target.value } : current))}
                placeholder="Teléfono de contacto"
                className="rounded border border-black/10 bg-zinc-50 px-4 py-3"
              />
              <textarea
                value={store.description}
                onChange={(event) =>
                  setStore((current) => (current ? { ...current, description: event.target.value } : current))
                }
                rows={4}
                placeholder="Cuenta qué hace especial a tu negocio"
                className="rounded border border-black/10 bg-zinc-50 px-4 py-3 md:col-span-2"
              />
            </div>
          ) : null}
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Dirección del local</p>
              <h2 className="mt-2 text-xl font-bold text-ink">Ubicación comercial</h2>
              <p className="mt-2 text-sm text-zinc-600">
                Configura la dirección solo cuando quieras agregarla, editarla o eliminarla. El delivery requiere esta ubicación completa.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {hasAddressDraft ? (
                <>
                  <Button type="button" onClick={handleOpenAddressEditor} aria-label="Editar direccion">
                    Editar dirección
                  </Button>
                  <Button type="button" onClick={handleDeleteAddress} className="bg-rose-600 shadow-none" aria-label="Eliminar direccion">
                    Eliminar dirección
                  </Button>
                </>
              ) : (
                <Button type="button" onClick={handleOpenAddressEditor} className="shadow-none" aria-label="Agregar direccion">
                  Agregar dirección
                </Button>
              )}
            </div>
          </div>

          <div className="rounded bg-zinc-50 p-4 text-sm text-zinc-600">
            {hasAddressDraft ? (
              <div className="space-y-1">
                <p className="font-semibold text-ink">{addressSummary.streetLine || "Dirección cargada"}</p>
                {addressSummary.locationLine ? <p>{addressSummary.locationLine}</p> : null}
                <p className={deliveryAddressReady ? "text-emerald-700" : "text-amber-700"}>
                  {deliveryAddressReady
                    ? "Dirección completa y geolocalizada."
                    : "Dirección incompleta. Completa calle, altura, CP, localidad y geolocalización para delivery."}
                </p>
              </div>
            ) : (
              <p>Sin dirección configurada. Agrégala solo cuando quieras dejar listo el local para operar con delivery.</p>
            )}
          </div>

          {showAddressEditor ? (
            <div className="rounded border border-black/10 bg-white p-4">
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

        <section className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Imágenes</p>
            <h2 className="mt-2 text-xl font-bold text-ink">Logo y portada</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Tu comercio ya recibe una imagen inicial por rubro. Si quieres personalizarla, puedes subir archivos desde tu dispositivo o pegar una URL.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <ImageAssetField
              label="Portada"
              value={store.cover_image_url ?? ""}
              onChange={(value) =>
                setStore((current) => (current ? { ...current, cover_image_url: value || null } : current))
              }
              folder="stores"
              description="Visible en la ficha del comercio."
            />
            <ImageAssetField
              label="Logo"
              value={store.logo_url ?? ""}
              onChange={(value) => setStore((current) => (current ? { ...current, logo_url: value || null } : current))}
              folder="stores"
              description="Visible en listados y encabezados."
              previewClassName="h-40 w-full object-contain bg-white p-5"
            />
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Operación</p>
            <h2 className="mt-2 text-xl font-bold text-ink">Entregas, cobros y disponibilidad</h2>
            <p className="mt-2 text-sm text-zinc-600">
              El costo de delivery lo defines tu comercio y no forma parte del fee global de plataforma cobrado al comprador.
            </p>
          </div>
          <div className="rounded border border-black/5 bg-zinc-50 p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-ink">Mercado Pago</p>
                  <span
                    className={`rounded px-3 py-1 text-xs font-semibold ${
                      mercadopagoConnected
                        ? "bg-emerald-100 text-emerald-800"
                        : mercadopagoReconnectRequired
                          ? "bg-amber-100 text-amber-900"
                          : mercadopagoConnectionStatus === "onboarding_pending"
                            ? "bg-sky-100 text-sky-800"
                          : "bg-zinc-200 text-zinc-700"
                    }`}
                  >
                    {mercadopagoConnectionLabels[mercadopagoConnectionStatus] ?? mercadopagoConnectionLabels.disconnected}
                  </span>
                  <span className="rounded bg-white px-3 py-1 text-xs font-semibold text-zinc-600">
                    Modo {mercadopagoModeLabel}
                  </span>
                </div>
                <p className="text-sm text-zinc-600">
                  {mercadopagoProviderEnabled
                    ? mercadopagoConnectionMessages[mercadopagoConnectionStatus] ?? mercadopagoConnectionMessages.disconnected
                    : "Mercado Pago está desactivado globalmente. Pide al admin que habilite la app OAuth para conectarlo."}
                </p>
                <div className="grid gap-2 text-sm text-zinc-600 md:grid-cols-2">
                  <p>
                    Cuenta vinculada: <span className="font-semibold text-ink">{mercadopagoMpUserId ?? "Sin cuenta conectada"}</span>
                  </p>
                  <p>
                    Onboarding: <span className="font-semibold text-ink">{mercadopagoOnboardingCompleted ? "Completo" : "Pendiente"}</span>
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => void handleMercadoPagoConnect()}
                  disabled={!mercadopagoProviderEnabled || mercadoPagoAction !== null}
                  className="shadow-none"
                >
                  {mercadoPagoAction === "connect"
                    ? "Conectando..."
                    : mercadopagoReconnectRequired
                      ? "Reconectar Mercado Pago"
                      : mercadopagoHasAccount
                        ? "Cambiar cuenta"
                        : "Conectar con Mercado Pago"}
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleMercadoPagoDisconnect()}
                  disabled={!mercadopagoHasAccount || mercadoPagoAction !== null}
                  className="bg-rose-700 shadow-none hover:bg-rose-800"
                >
                  {mercadoPagoAction === "disconnect" ? "Desconectando..." : "Desconectar"}
                </Button>
              </div>
            </div>
            {mercadoPagoActionError ? (
              <p className="mt-3 rounded bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{mercadoPagoActionError}</p>
            ) : null}
          </div>
          <div
            className={`rounded px-4 py-4 text-sm ${
              isApproved
                ? "border border-black/5 bg-zinc-50 text-zinc-700"
                : "border border-amber-200 bg-amber-50 text-amber-950"
            }`}
          >
            {isApproved
              ? 'La recepción de pedidos se administra desde la pantalla "Pedidos". Aquí configuras delivery, retiro y medios de cobro.'
              : 'Podrás habilitar la venta desde la pantalla "Pedidos" una vez que el equipo apruebe tu comercio.'}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-2 rounded bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700">
              <input
                type="checkbox"
                checked={store.delivery_settings.delivery_enabled}
                onChange={(event) => {
                  if (event.target.checked && !deliveryAddressReady) {
                    setError("Configura CP, provincia, localidad, calle, altura y geolocalización del local antes de habilitar delivery.");
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
            <label className="flex items-center gap-2 rounded bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700">
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
            <label className="flex items-center gap-2 rounded bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700">
              <input
                type="checkbox"
                checked={store.payment_settings.cash_enabled}
                onChange={(event) =>
                  setStore((current) =>
                    current
                      ? {
                          ...current,
                          payment_settings: { ...current.payment_settings, cash_enabled: event.target.checked }
                        }
                      : current
                  )
                }
              />
              Efectivo
            </label>
            <label
              className={`flex items-center gap-2 rounded bg-zinc-50 px-4 py-3 text-sm font-semibold ${
                mercadopagoCanOperate ? "text-zinc-700" : "cursor-not-allowed text-zinc-400"
              }`}
            >
              <input
                type="checkbox"
                checked={store.payment_settings.mercadopago_enabled}
                disabled={!mercadopagoCanOperate}
                onChange={(event) => {
                  if (event.target.checked && !mercadopagoCanOperate) {
                    setError("Conecta una cuenta activa de Mercado Pago antes de habilitar este medio de cobro.");
                    return;
                  }
                  setStore((current) =>
                    current
                      ? {
                          ...current,
                          payment_settings: {
                            ...current.payment_settings,
                            mercadopago_enabled: event.target.checked
                          }
                        }
                      : current
                  );
                }}
              />
              Mercado Pago
            </label>
          </div>
          {!mercadopagoProviderEnabled ? (
            <p className="rounded border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
              El medio de pago online está desactivado a nivel plataforma. Cuando el admin lo habilite podrás conectar tu cuenta.
            </p>
          ) : null}
          {mercadopagoProviderEnabled && !mercadopagoCanOperate ? (
            <p className="rounded border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
              {mercadopagoState?.reason ?? "Mercado Pago queda deshabilitado para cobros hasta que conectes una cuenta válida."}
            </p>
          ) : null}
          {!deliveryAddressReady ? (
            <p className="rounded border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
              El delivery permanece bloqueado hasta que la dirección del comercio quede configurada con CP, localidad y punto exacto en el mapa.
            </p>
          ) : null}
        </section>

        <section className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Parámetros</p>
            <h2 className="mt-2 text-xl font-bold text-ink">Detalle operativo</h2>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-600">
              <span>El fee de plataforma es global y lo administra</span>
              <PlatformWordmark
                size="inline"
                frameClassName="w-[8.75rem]"
                textClassName="text-sm font-semibold text-ink"
              />
              <span>. Aquí solo configuras tiempos, mínimo de compra y delivery de tu comercio.</span>
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={store.opening_note ?? ""}
              onChange={(event) =>
                setStore((current) => (current ? { ...current, opening_note: event.target.value || null } : current))
              }
              placeholder="Nota visible para tus clientes"
              className="rounded border border-black/10 bg-zinc-50 px-4 py-3 md:col-span-2"
            />
            <label className="rounded border border-black/10 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
              Minutos mínimos de entrega
              <input
                type="number"
                min={0}
                value={store.min_delivery_minutes}
                onChange={(event) =>
                  setStore((current) =>
                    current ? { ...current, min_delivery_minutes: toNumber(event.target.value) } : current
                  )
                }
                className="mt-2 w-full bg-transparent text-base font-semibold text-ink outline-none"
              />
            </label>
            <label className="rounded border border-black/10 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
              Minutos máximos de entrega
              <input
                type="number"
                min={0}
                value={store.max_delivery_minutes}
                onChange={(event) =>
                  setStore((current) =>
                    current ? { ...current, max_delivery_minutes: toNumber(event.target.value) } : current
                  )
                }
                className="mt-2 w-full bg-transparent text-base font-semibold text-ink outline-none"
              />
            </label>
            <label className="rounded border border-black/10 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
              Costo de delivery
              <input
                type="number"
                min={0}
                step="0.01"
                value={store.delivery_settings.delivery_fee}
                onChange={(event) =>
                  setStore((current) =>
                    current
                      ? {
                          ...current,
                          delivery_settings: {
                            ...current.delivery_settings,
                            delivery_fee: toNumber(event.target.value)
                          }
                        }
                      : current
                  )
                }
                className="mt-2 w-full bg-transparent text-base font-semibold text-ink outline-none"
              />
            </label>
            <label className="rounded border border-black/10 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
              Envío gratis desde
              <input
                type="number"
                min={0}
                step="0.01"
                value={store.delivery_settings.free_delivery_min_order ?? ""}
                onChange={(event) =>
                  setStore((current) =>
                    current
                      ? {
                          ...current,
                          delivery_settings: {
                            ...current.delivery_settings,
                            free_delivery_min_order: toOptionalNumber(event.target.value)
                          }
                        }
                      : current
                  )
                }
                placeholder="Opcional"
                className="mt-2 w-full bg-transparent text-base font-semibold text-ink outline-none"
              />
            </label>
            <label className="rounded border border-black/10 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
              Pago fijo al rider
              <input
                type="number"
                min={0}
                step="0.01"
                value={store.delivery_settings.rider_fee}
                onChange={(event) =>
                  setStore((current) =>
                    current
                      ? {
                          ...current,
                          delivery_settings: {
                            ...current.delivery_settings,
                            rider_fee: toNumber(event.target.value)
                          }
                        }
                      : current
                  )
                }
                className="mt-2 w-full bg-transparent text-base font-semibold text-ink outline-none"
              />
            </label>
            <label className="rounded border border-black/10 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
              Pedido mínimo
              <input
                type="number"
                min={0}
                step="0.01"
                value={store.delivery_settings.min_order}
                onChange={(event) =>
                  setStore((current) =>
                    current
                      ? {
                          ...current,
                          delivery_settings: {
                            ...current.delivery_settings,
                            min_order: toNumber(event.target.value)
                          }
                        }
                      : current
                  )
                }
                className="mt-2 w-full bg-transparent text-base font-semibold text-ink outline-none"
              />
            </label>
          </div>
        </section>

        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">Rubros</p>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => {
              const selected = selectedCategoryIds.includes(category.id);
              return (
                <RubroChip
                  key={category.id}
                  label={category.name}
                  color={category.color}
                  colorLight={category.color_light}
                  icon={category.icon}
                  selected={selected}
                  onClick={() =>
                    setSelectedCategoryIds((current) =>
                      current.includes(category.id) ? current.filter((id) => id !== category.id) : [...current, category.id]
                    )
                  }
                />
              );
            })}
          </div>
        </section>

        {error ? <p className="rounded bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-zinc-500">
            Guarda tus cambios cuando quieras. La activación comercial depende de la aprobación del equipo.
          </p>
          <Button type="submit" disabled={saving}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </form>

      <section className="space-y-5 rounded bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Catálogo</p>
            <h2 className="mt-2 text-xl font-bold text-ink">Categorías y subcategorías</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Administra la taxonomía del menú. El alta de producto usa estas categorías para ordenar el catálogo.
            </p>
          </div>
          <span className="rounded bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-600">
            {productCategories.length} categorías activas
          </span>
        </div>

        <form onSubmit={(event) => void handleCategorySubmit(event)} className="grid gap-3 rounded border border-black/5 bg-zinc-50 p-4 md:grid-cols-[1fr_160px_auto]">
          <input
            value={categoryForm.name}
            onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Nombre de categoría"
            className="rounded border border-black/10 bg-white px-4 py-3"
          />
          <input
            type="number"
            min={0}
            value={categoryForm.sort_order}
            onChange={(event) => setCategoryForm((current) => ({ ...current, sort_order: event.target.value }))}
            placeholder="Orden"
            className="rounded border border-black/10 bg-white px-4 py-3"
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={taxonomySaving} className="w-full md:w-auto">
              {taxonomySaving ? "Guardando..." : editingCategoryId ? "Actualizar categoría" : "Crear categoría"}
            </Button>
            {editingCategoryId ? (
              <button
                type="button"
                onClick={resetCategoryEditor}
                className="rounded bg-white px-4 py-3 text-sm font-semibold text-zinc-700 shadow-sm"
              >
                Cancelar
              </button>
            ) : null}
          </div>
        </form>

        {taxonomyError ? <p className="rounded bg-rose-50 px-4 py-3 text-sm text-rose-700">{taxonomyError}</p> : null}

        <div className="space-y-4">
          {productCategories.map((category) => {
            const draft = subcategoryDrafts[category.id] ?? emptySubcategoryDraft();
            return (
              <article key={category.id} className="rounded border border-black/5 bg-zinc-50 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold text-ink">{category.name}</h3>
                      <span className="rounded bg-white px-3 py-1 text-xs font-semibold text-zinc-600">
                        Orden {category.sort_order}
                      </span>
                      <span className="rounded bg-white px-3 py-1 text-xs font-semibold text-zinc-600">
                        {category.subcategories.length} subcategorías
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-zinc-600">Usa subcategorías para ordenar mejor el alta de productos.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCategoryId(category.id);
                        setCategoryForm({ name: category.name, sort_order: String(category.sort_order) });
                      }}
                      className="rounded bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm"
                    >
                      Editar categoría
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteCategory(category.id)}
                      className="rounded bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700"
                    >
                      Eliminar categoría
                    </button>
                  </div>
                </div>

                <form
                  onSubmit={(event) => void handleSubcategorySubmit(event, category.id)}
                  className="mt-4 grid gap-3 rounded border border-black/5 bg-white p-4 md:grid-cols-[1fr_160px_auto]"
                >
                  <input
                    value={draft.name}
                    onChange={(event) => setSubcategoryDraft(category.id, { name: event.target.value })}
                    placeholder="Nombre de subcategoría"
                    className="rounded border border-black/10 bg-zinc-50 px-4 py-3"
                  />
                  <input
                    type="number"
                    min={0}
                    value={draft.sort_order}
                    onChange={(event) => setSubcategoryDraft(category.id, { sort_order: event.target.value })}
                    placeholder="Orden"
                    className="rounded border border-black/10 bg-zinc-50 px-4 py-3"
                  />
                  <div className="flex gap-2">
                    <Button type="submit" disabled={taxonomySaving} className="w-full md:w-auto">
                      {taxonomySaving ? "Guardando..." : draft.editingId ? "Actualizar subcategoría" : "Crear subcategoría"}
                    </Button>
                    {draft.editingId ? (
                      <button
                        type="button"
                        onClick={() => setSubcategoryDraft(category.id, emptySubcategoryDraft())}
                        className="rounded bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-700"
                      >
                        Cancelar
                      </button>
                    ) : null}
                  </div>
                </form>

                <div className="mt-4 flex flex-wrap gap-2">
                  {category.subcategories.map((subcategory) => (
                    <div key={subcategory.id} className="flex items-center gap-2 rounded bg-white px-3 py-2 text-sm shadow-sm">
                      <span className="font-semibold text-ink">{subcategory.name}</span>
                      <span className="text-xs text-zinc-400">#{subcategory.sort_order}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setSubcategoryDraft(category.id, {
                            editingId: subcategory.id,
                            name: subcategory.name,
                            sort_order: String(subcategory.sort_order)
                          })
                        }
                        className="text-xs font-semibold text-brand-600"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteSubcategory(subcategory.id, category.id)}
                        className="text-xs font-semibold text-rose-700"
                      >
                        Eliminar
                      </button>
                    </div>
                  ))}
                  {!category.subcategories.length ? (
                    <p className="text-sm text-zinc-500">Aún no creaste subcategorías para esta categoría.</p>
                  ) : null}
                </div>
              </article>
            );
          })}

          {!productCategories.length ? (
            <EmptyState
              title="Sin categorías de producto"
              description="Crea tu primera categoría para habilitar el alta de productos."
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}
