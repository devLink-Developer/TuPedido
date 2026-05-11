import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { EmptyState, ImageAssetField, LoadingCard, PageHeader, PlatformWordmark, RubroChip, StatusPill } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import {
  createMerchantProductCategory,
  createMerchantProductSubcategory,
  deleteMerchantProductCategory,
  deleteMerchantProductSubcategory,
  fetchMerchantProductCategories,
  fetchMerchantStore,
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
import { useMerchantStoreStatusSync } from "../hooks/useMerchantStoreStatusSync";

const storeStatusMessages: Record<string, string> = {
  pending_review:
    "Tu solicitud está en revisión. Ya puedes preparar catálogo, pagos e imágenes, pero el local seguirá cerrado hasta la aprobación.",
  approved: "Tu comercio ya puede operar normalmente. Activa la recepción de pedidos cuando estés listo.",
  rejected: "La solicitud fue rechazada. Revisa tus datos y actualiza la configuración antes de volver a solicitar aprobación.",
  suspended: "Tu operación está suspendida temporalmente. Puedes revisar la configuración, pero no recibir pedidos."
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

  const statusMessage = useMemo(() => {
    if (!store) return "";
    return storeStatusMessages[store.status] ?? "Actualiza la información de tu negocio y mantente listo para operar.";
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
      const nextMercadoPagoEnabled = store.payment_settings.mercadopago_enabled;
      if (!store.payment_settings.cash_enabled && !nextMercadoPagoEnabled) {
        setError("Deja efectivo activo o habilita Mercado Pago desde su menu dedicado.");
        return;
      }

      await updateMerchantStore(token, {
        name: store.name,
        description: store.description,
        address: store.address,
        postal_code: store.postal_code ?? null,
        province: store.province ?? null,
        locality: store.locality ?? null,
        phone: store.phone,
        latitude: store.latitude ?? null,
        longitude: store.longitude ?? null,
        logo_url: store.logo_url,
        cover_image_url: store.cover_image_url,
        accepting_orders: store.accepting_orders,
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
        description="Administra identidad, imagenes, pagos simples, tarifas y categorias. La direccion y los poligonos se configuran desde su menu dedicado."
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

      <section className="rounded border border-[var(--kp-stroke)] bg-[#fffaf5] p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--kp-accent)]">Direccion y alcance</p>
            <h2 className="mt-2 text-lg font-bold text-ink">La ubicacion y los poligonos ahora tienen menu propio</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
              Usa esta pantalla solo para identidad, imagenes, pagos simples, tarifas y categorias.
            </p>
          </div>
          <Link
            to="/m/alcance"
            className="inline-flex min-h-[44px] items-center justify-center rounded bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            Abrir direccion y alcance
          </Link>
        </div>
      </section>


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
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Medios de pago</p>
            <h2 className="mt-2 text-xl font-bold text-ink">Efectivo</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Mercado Pago se administra desde su menu dedicado. Aqui solo defines si aceptas efectivo.
            </p>
          </div>
          <label className="flex min-h-[52px] cursor-pointer items-center gap-2 rounded bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700 md:max-w-md">
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
            Aceptar efectivo
          </label>
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
