import { useEffect, useMemo, useState, type FormEvent } from "react";
import { EmptyState, ImageAssetField, LoadingCard, PageHeader, RubroChip, StatusPill } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import {
  createMerchantProductCategory,
  createMerchantProductSubcategory,
  deleteMerchantProductCategory,
  deleteMerchantProductSubcategory,
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
import {
  StoreAddressSection,
  emptyStoreAddressForm,
  hasStoreAddressConfiguration,
  toStoreAddressFormState,
  toStoreAddressPayload,
  type StoreAddressFormState
} from "../components/StoreAddressSection";

const storeStatusMessages: Record<string, string> = {
  pending_review:
    "Tu solicitud esta en revision. Ya puedes preparar catalogo, pagos e imagenes, pero el local seguira cerrado hasta la aprobacion.",
  approved: "Tu comercio ya puede operar normalmente. Activa la recepcion de pedidos cuando estes listo.",
  rejected: "La solicitud fue rechazada. Revisa tus datos y actualiza la configuracion antes de volver a solicitar aprobacion.",
  suspended: "Tu operacion esta suspendida temporalmente. Puedes revisar la configuracion, pero no recibir pedidos."
};

function toNumber(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function emptySubcategoryDraft(): SubcategoryDraftState {
  return {
    name: "",
    sort_order: "0",
    editingId: null
  };
}

export function SettingsPage() {
  const { token } = useAuthSession();
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

  const isApproved = store?.status === "approved";
  const canToggleOrders = isApproved;
  const deliveryAddressReady = hasStoreAddressConfiguration(storeAddressForm);
  const statusMessage = useMemo(() => {
    if (!store) return "";
    return storeStatusMessages[store.status] ?? "Actualiza la informacion de tu negocio y mantente listo para operar.";
  }, [store]);

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
      setError(requestError instanceof Error ? requestError.message : "No se pudo cargar la configuracion");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !store) return;
    setError(null);
    if (!selectedCategoryIds.length) {
      setError("Selecciona al menos un rubro para tu comercio.");
      return;
    }
    if (store.max_delivery_minutes < store.min_delivery_minutes) {
      setError("El tiempo maximo de entrega debe ser mayor o igual al minimo.");
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
        setError("Configura la direccion completa del local y su geolocalizacion antes de habilitar delivery.");
        return;
      }

      const addressPayload =
        toStoreAddressPayload(nextStoreAddressForm) ?? {
          address: store.address,
          postal_code: store.postal_code ?? null,
          province: store.province ?? null,
          locality: store.locality ?? null,
          latitude: store.latitude ?? null,
          longitude: store.longitude ?? null
        };
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
        mercadopago_enabled: store.payment_settings.mercadopago_enabled
      });
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo guardar la configuracion");
    } finally {
      setSaving(false);
    }
  }

  async function handleCategorySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    if (!categoryForm.name.trim()) {
      setTaxonomyError("Ingresa un nombre para la categoria.");
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
      setTaxonomyError(requestError instanceof Error ? requestError.message : "No se pudo guardar la categoria");
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
      setTaxonomyError(requestError instanceof Error ? requestError.message : "No se pudo eliminar la categoria");
    } finally {
      setTaxonomySaving(false);
    }
  }

  async function handleSubcategorySubmit(event: FormEvent<HTMLFormElement>, categoryId: number) {
    event.preventDefault();
    if (!token) return;
    const draft = subcategoryDrafts[categoryId] ?? emptySubcategoryDraft();
    if (!draft.name.trim()) {
      setTaxonomyError("Ingresa un nombre para la subcategoria.");
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
      setTaxonomyError(requestError instanceof Error ? requestError.message : "No se pudo guardar la subcategoria");
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
      setTaxonomyError(requestError instanceof Error ? requestError.message : "No se pudo eliminar la subcategoria");
    } finally {
      setTaxonomySaving(false);
    }
  }

  if (loading || categoryLoading) return <LoadingCard />;
  if (!store) {
    return <EmptyState title="Configuracion no disponible" description={error ?? "Faltan datos del comercio"} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Comercio"
        title="Configura tu local"
        description="Prepara tu marca, tiempos de entrega y medios de cobro. Si tu alta aun esta en revision, el panel queda listo pero la operacion sigue cerrada."
      />

      <section className="rounded-[28px] border border-black/5 bg-white p-5 shadow-sm">
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

      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5 rounded-[28px] bg-white p-5 shadow-sm">
        <section className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Datos del local</p>
            <h2 className="mt-2 text-xl font-bold text-ink">Identidad comercial</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={store.name}
              onChange={(event) => setStore((current) => (current ? { ...current, name: event.target.value } : current))}
              placeholder="Nombre del local"
              className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
            />
            <input
              value={store.phone}
              onChange={(event) => setStore((current) => (current ? { ...current, phone: event.target.value } : current))}
              placeholder="Telefono de contacto"
              className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
            />
            <textarea
              value={store.description}
              onChange={(event) =>
                setStore((current) => (current ? { ...current, description: event.target.value } : current))
              }
              rows={4}
              placeholder="Cuenta que hace especial a tu negocio"
              className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 md:col-span-2"
            />
          </div>
        </section>

        <StoreAddressSection
          token={token}
          form={storeAddressForm}
          onChange={(value) => {
            setStoreAddressForm(value);
            setError(null);
          }}
        />

        <section className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Imagenes</p>
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
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Operacion</p>
            <h2 className="mt-2 text-xl font-bold text-ink">Entregas, cobros y disponibilidad</h2>
          </div>
          {!isApproved ? (
            <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
              Podras activar "Recibir pedidos" una vez que el equipo apruebe tu comercio.
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            <label
              className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${
                canToggleOrders ? "bg-zinc-50 text-zinc-700" : "bg-zinc-100 text-zinc-400"
              }`}
            >
              <input
                type="checkbox"
                checked={canToggleOrders ? store.accepting_orders : false}
                disabled={!canToggleOrders}
                onChange={(event) =>
                  setStore((current) => (current ? { ...current, accepting_orders: event.target.checked } : current))
                }
              />
              Recibir pedidos
            </label>
            <label className="flex items-center gap-2 rounded-2xl bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700">
              <input
                type="checkbox"
                checked={store.delivery_settings.delivery_enabled}
                onChange={(event) => {
                  if (event.target.checked && !deliveryAddressReady) {
                    setError("Configura CP, provincia, localidad, calle, altura y geolocalizacion del local antes de habilitar delivery.");
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
            <label className="flex items-center gap-2 rounded-2xl bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700">
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
            <label className="flex items-center gap-2 rounded-2xl bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700">
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
            <label className="flex items-center gap-2 rounded-2xl bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700">
              <input
                type="checkbox"
                checked={store.payment_settings.mercadopago_enabled}
                onChange={(event) =>
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
                  )
                }
              />
              Mercado Pago
            </label>
          </div>
          {!deliveryAddressReady ? (
            <p className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
              El delivery permanece bloqueado hasta que la direccion del comercio quede configurada con CP, localidad y punto exacto en el mapa.
            </p>
          ) : null}
        </section>

        <section className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Parametros</p>
            <h2 className="mt-2 text-xl font-bold text-ink">Detalle operativo</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={store.opening_note ?? ""}
              onChange={(event) =>
                setStore((current) => (current ? { ...current, opening_note: event.target.value || null } : current))
              }
              placeholder="Nota visible para tus clientes"
              className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 md:col-span-2"
            />
            <label className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
              Minutos minimos de entrega
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
            <label className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
              Minutos maximos de entrega
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
            <label className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
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
            <label className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
              Pedido minimo
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

        {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-zinc-500">
            Guarda tus cambios cuando quieras. La activacion comercial depende de la aprobacion del equipo.
          </p>
          <Button type="submit" disabled={saving}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </form>

      <section className="space-y-5 rounded-[28px] bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Catalogo</p>
            <h2 className="mt-2 text-xl font-bold text-ink">Categorias y subcategorias</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Administra la taxonomia del menu. El alta de producto usa estas categorias para ordenar el catalogo.
            </p>
          </div>
          <span className="rounded-full bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-600">
            {productCategories.length} categorias activas
          </span>
        </div>

        <form onSubmit={(event) => void handleCategorySubmit(event)} className="grid gap-3 rounded-[24px] border border-black/5 bg-zinc-50 p-4 md:grid-cols-[1fr_160px_auto]">
          <input
            value={categoryForm.name}
            onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Nombre de categoria"
            className="rounded-2xl border border-black/10 bg-white px-4 py-3"
          />
          <input
            type="number"
            min={0}
            value={categoryForm.sort_order}
            onChange={(event) => setCategoryForm((current) => ({ ...current, sort_order: event.target.value }))}
            placeholder="Orden"
            className="rounded-2xl border border-black/10 bg-white px-4 py-3"
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={taxonomySaving} className="w-full md:w-auto">
              {taxonomySaving ? "Guardando..." : editingCategoryId ? "Actualizar categoria" : "Crear categoria"}
            </Button>
            {editingCategoryId ? (
              <button
                type="button"
                onClick={resetCategoryEditor}
                className="rounded-full bg-white px-4 py-3 text-sm font-semibold text-zinc-700 shadow-sm"
              >
                Cancelar
              </button>
            ) : null}
          </div>
        </form>

        {taxonomyError ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{taxonomyError}</p> : null}

        <div className="space-y-4">
          {productCategories.map((category) => {
            const draft = subcategoryDrafts[category.id] ?? emptySubcategoryDraft();
            return (
              <article key={category.id} className="rounded-[24px] border border-black/5 bg-zinc-50 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold text-ink">{category.name}</h3>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-600">
                        Orden {category.sort_order}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-600">
                        {category.subcategories.length} subcategorias
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-zinc-600">Usa subcategorias para ordenar mejor el alta de productos.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCategoryId(category.id);
                        setCategoryForm({ name: category.name, sort_order: String(category.sort_order) });
                      }}
                      className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm"
                    >
                      Editar categoria
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteCategory(category.id)}
                      className="rounded-full bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700"
                    >
                      Eliminar categoria
                    </button>
                  </div>
                </div>

                <form
                  onSubmit={(event) => void handleSubcategorySubmit(event, category.id)}
                  className="mt-4 grid gap-3 rounded-[22px] border border-black/5 bg-white p-4 md:grid-cols-[1fr_160px_auto]"
                >
                  <input
                    value={draft.name}
                    onChange={(event) => setSubcategoryDraft(category.id, { name: event.target.value })}
                    placeholder="Nombre de subcategoria"
                    className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
                  />
                  <input
                    type="number"
                    min={0}
                    value={draft.sort_order}
                    onChange={(event) => setSubcategoryDraft(category.id, { sort_order: event.target.value })}
                    placeholder="Orden"
                    className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
                  />
                  <div className="flex gap-2">
                    <Button type="submit" disabled={taxonomySaving} className="w-full md:w-auto">
                      {taxonomySaving ? "Guardando..." : draft.editingId ? "Actualizar subcategoria" : "Crear subcategoria"}
                    </Button>
                    {draft.editingId ? (
                      <button
                        type="button"
                        onClick={() => setSubcategoryDraft(category.id, emptySubcategoryDraft())}
                        className="rounded-full bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-700"
                      >
                        Cancelar
                      </button>
                    ) : null}
                  </div>
                </form>

                <div className="mt-4 flex flex-wrap gap-2">
                  {category.subcategories.map((subcategory) => (
                    <div key={subcategory.id} className="flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm shadow-sm">
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
                    <p className="text-sm text-zinc-500">Aun no creaste subcategorias para esta categoria.</p>
                  ) : null}
                </div>
              </article>
            );
          })}

          {!productCategories.length ? (
            <EmptyState
              title="Sin categorias de producto"
              description="Crea tu primera categoria para habilitar el alta de productos."
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}
