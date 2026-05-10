import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BrandWordmark, CatalogBanner, EmptyState, ImageAssetField, LoadingCard, PageHeader } from "../../../shared/components";
import { CATALOG_BANNER_RECOMMENDATION, formatCatalogBannerRatio, resolveCatalogBannerDimensions } from "../../../shared/config/catalogBanner";
import { useAuthSession } from "../../../shared/hooks";
import { useCategoryStore } from "../../../shared/stores";
import {
  createAdminCategory,
  createAdminSettlementPayment,
  deleteAdminCategory,
  fetchAdminCategories,
  fetchAdminSettlementNotices,
  fetchAdminSettlementPayments,
  fetchAdminSettlementStores,
  fetchPlatformSettings,
  reviewAdminSettlementNotice,
  updateAdminCategory,
  updatePlatformSettings
} from "../../../shared/services/api";
import type {
  AdminSettlementStore,
  Category,
  CategoryWrite,
  PlatformSettings,
  SettlementNotice,
  SettlementPayment
} from "../../../shared/types";
import { hexToRgba, isHexColor, normalizeHexColor, resolveCategoryPalette } from "../../../shared/utils/categoryTheme";
import { formatCurrency, formatDateTime } from "../../../shared/utils/format";
import { statusLabels } from "../../../shared/utils/labels";
import { Button } from "../../../shared/ui/Button";

type CategoryFormState = {
  name: string;
  description: string;
  color: string;
  color_light: string;
  icon: string;
  sort_order: string;
  is_active: boolean;
};

const emptyCategoryForm: CategoryFormState = {
  name: "",
  description: "",
  color: "#FF7043",
  color_light: "",
  icon: "",
  sort_order: "0",
  is_active: true
};

const suggestedColors = ["#FF7043", "#29B6F6", "#66BB6A", "#AB47BC", "#EF5350", "#FFCA28", "#8D6E63", "#26A69A"];

function toNumber(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toCategoryForm(category: Category): CategoryFormState {
  return {
    name: category.name,
    description: category.description ?? "",
    color: category.color,
    color_light: category.color_light,
    icon: category.icon ?? "",
    sort_order: String(category.sort_order),
    is_active: category.is_active
  };
}

function toCategoryPayload(form: CategoryFormState): CategoryWrite {
  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    color: form.color.trim().toUpperCase(),
    color_light: form.color_light.trim() ? form.color_light.trim().toUpperCase() : null,
    icon: form.icon.trim() || null,
    is_active: form.is_active,
    sort_order: toNumber(form.sort_order)
  };
}

function previewLabel(name: string, icon: string) {
  const trimmed = icon.trim();
  if (trimmed) return trimmed.slice(0, 2).toUpperCase();
  return (name.trim().slice(0, 2) || "RB").toUpperCase();
}

export function SettingsPage() {
  const { token } = useAuthSession();
  const syncPublicCategories = useCategoryStore((state) => state.setCategories);
  const [categories, setCategories] = useState<Category[]>([]);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null);
  const [settlementStores, setSettlementStores] = useState<AdminSettlementStore[]>([]);
  const [settlementNotices, setSettlementNotices] = useState<SettlementNotice[]>([]);
  const [settlementPayments, setSettlementPayments] = useState<SettlementPayment[]>([]);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(emptyCategoryForm);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [serviceFee, setServiceFee] = useState("0");
  const [catalogBannerImageUrl, setCatalogBannerImageUrl] = useState("");
  const [catalogBannerWidth, setCatalogBannerWidth] = useState(String(CATALOG_BANNER_RECOMMENDATION.width));
  const [catalogBannerHeight, setCatalogBannerHeight] = useState(String(CATALOG_BANNER_RECOMMENDATION.height));
  const [paymentForm, setPaymentForm] = useState({ store_id: "", amount: "", reference: "", notes: "" });
  const [noticeNotes, setNoticeNotes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [categorySaving, setCategorySaving] = useState(false);
  const [serviceSaving, setServiceSaving] = useState(false);
  const [bannerSaving, setBannerSaving] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const categoryPreview = useMemo(
    () => resolveCategoryPalette({ color: categoryForm.color, color_light: categoryForm.color_light || null }),
    [categoryForm.color, categoryForm.color_light]
  );
  const previewBannerDimensions = useMemo(
    () => resolveCatalogBannerDimensions(Number(catalogBannerWidth), Number(catalogBannerHeight)),
    [catalogBannerHeight, catalogBannerWidth]
  );
  const previewBannerRatio = useMemo(
    () => formatCatalogBannerRatio(previewBannerDimensions.width, previewBannerDimensions.height),
    [previewBannerDimensions.height, previewBannerDimensions.width]
  );
  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const [noticeResult, paymentResult, categoriesResult, platformResult, storesWithBalanceResult] = await Promise.all([
        fetchAdminSettlementNotices(token),
        fetchAdminSettlementPayments(token),
        fetchAdminCategories(token),
        fetchPlatformSettings(token),
        fetchAdminSettlementStores(token)
      ]);
      setCategories(categoriesResult);
      syncPublicCategories(categoriesResult.filter((category) => category.is_active));
      setPlatformSettings(platformResult);
      setServiceFee(platformResult.service_fee_amount.toFixed(2));
      setCatalogBannerImageUrl(platformResult.catalog_banner_image_url ?? "");
      setCatalogBannerWidth(String(platformResult.catalog_banner_width ?? CATALOG_BANNER_RECOMMENDATION.width));
      setCatalogBannerHeight(String(platformResult.catalog_banner_height ?? CATALOG_BANNER_RECOMMENDATION.height));
      setSettlementStores(storesWithBalanceResult);
      setSettlementNotices(noticeResult);
      setSettlementPayments(paymentResult);
      setPaymentForm((current) => ({ ...current, store_id: current.store_id || String(storesWithBalanceResult[0]?.id ?? "") }));
      setError(null);
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
    setCategoryError(null);
  }

  async function handleCategorySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    if (!categoryForm.name.trim()) {
      setCategoryError("El nombre del rubro es obligatorio.");
      return;
    }
    if (!isHexColor(categoryForm.color)) {
      setCategoryError("El color principal debe usar formato HEX #RRGGBB.");
      return;
    }
    if (categoryForm.color_light.trim() && !isHexColor(categoryForm.color_light)) {
      setCategoryError("El color claro debe usar formato HEX #RRGGBB.");
      return;
    }

    setCategorySaving(true);
    setCategoryError(null);
    try {
      const payload = toCategoryPayload(categoryForm);
      if (editingCategoryId) {
        await updateAdminCategory(token, editingCategoryId, payload);
      } else {
        await createAdminCategory(token, payload);
      }
      resetCategoryEditor();
      await load();
    } catch (requestError) {
      setCategoryError(requestError instanceof Error ? requestError.message : "No se pudo guardar el rubro");
    } finally {
      setCategorySaving(false);
    }
  }

  async function handleCategoryDeactivate(categoryId: number) {
    if (!token) return;
    setCategorySaving(true);
    setCategoryError(null);
    try {
      await deleteAdminCategory(token, categoryId);
      if (editingCategoryId === categoryId) {
        resetCategoryEditor();
      }
      await load();
    } catch (requestError) {
      setCategoryError(requestError instanceof Error ? requestError.message : "No se pudo desactivar el rubro");
    } finally {
      setCategorySaving(false);
    }
  }

  async function handleCategoryReactivate(category: Category) {
    if (!token) return;
    setCategorySaving(true);
    setCategoryError(null);
    try {
      await updateAdminCategory(token, category.id, {
        name: category.name,
        description: category.description,
        color: category.color,
        color_light: category.color_light,
        icon: category.icon,
        is_active: true,
        sort_order: category.sort_order
      });
      await load();
    } catch (requestError) {
      setCategoryError(requestError instanceof Error ? requestError.message : "No se pudo reactivar el rubro");
    } finally {
      setCategorySaving(false);
    }
  }

  async function handleServiceFeeSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setServiceSaving(true);
    setServiceError(null);
    try {
      await updatePlatformSettings(token, { service_fee_amount: Number(serviceFee) || 0 });
      await load();
    } catch (requestError) {
      setServiceError(requestError instanceof Error ? requestError.message : "No se pudo guardar la tarifa");
    } finally {
      setServiceSaving(false);
    }
  }

  async function handleCatalogBannerSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !platformSettings) return;
    const nextWidth = Number(catalogBannerWidth);
    const nextHeight = Number(catalogBannerHeight);
    if (!Number.isInteger(nextWidth) || nextWidth <= 0) {
      setBannerError("El ancho del banner debe ser un numero entero positivo.");
      return;
    }
    if (!Number.isInteger(nextHeight) || nextHeight <= 0) {
      setBannerError("El alto del banner debe ser un numero entero positivo.");
      return;
    }
    setBannerSaving(true);
    setBannerError(null);
    try {
      await updatePlatformSettings(token, {
        service_fee_amount: platformSettings.service_fee_amount,
        catalog_banner_image_url: catalogBannerImageUrl.trim() || null,
        catalog_banner_width: nextWidth,
        catalog_banner_height: nextHeight,
      });
      await load();
    } catch (requestError) {
      setBannerError(requestError instanceof Error ? requestError.message : "No se pudo guardar el banner");
    } finally {
      setBannerSaving(false);
    }
  }

  async function handlePaymentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setPaymentSaving(true);
    setPaymentError(null);
    try {
      await createAdminSettlementPayment(token, {
        store_id: Number(paymentForm.store_id),
        amount: Number(paymentForm.amount),
        reference: paymentForm.reference || null,
        notes: paymentForm.notes || null
      });
      setPaymentForm((current) => ({ ...current, amount: "", reference: "", notes: "" }));
      await load();
    } catch (requestError) {
      setPaymentError(requestError instanceof Error ? requestError.message : "No se pudo registrar el pago");
    } finally {
      setPaymentSaving(false);
    }
  }

  async function handleNoticeReview(noticeId: number, status: "approved" | "rejected") {
    if (!token) return;
    setPaymentSaving(true);
    setPaymentError(null);
    try {
      await reviewAdminSettlementNotice(token, noticeId, {
        status,
        review_notes: noticeNotes[noticeId] ?? null
      });
      await load();
    } catch (requestError) {
      setPaymentError(requestError instanceof Error ? requestError.message : "No se pudo revisar el aviso");
    } finally {
      setPaymentSaving(false);
    }
  }

  if (loading) return <LoadingCard />;
  if (error || !platformSettings) {
    return <EmptyState title="Configuracion no disponible" description={error ?? "Sin datos"} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Configuracion"
        description="Administra rubros, el fee global cobrado al comprador y la revision de liquidaciones de cuenta corriente."
      />

      <section className="rounded bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Configuracion</p>
            <h2 className="mt-2 text-xl font-bold text-ink">Rubros</h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-zinc-600">
              Define nombre, color, icono, orden y estado. Estos cambios impactan en home, filtros y badges de comercios sin tocar codigo.
            </p>
          </div>
          <span className="rounded bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-600">
            {categories.filter((category) => category.is_active).length} activos / {categories.length} totales
          </span>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[420px_1fr]">
          <form
            onSubmit={(event) => void handleCategorySubmit(event)}
            className="space-y-4 rounded border border-black/5 bg-zinc-50 p-4"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">
                {editingCategoryId ? "Editar rubro" : "Nuevo rubro"}
              </p>
              <h3 className="mt-2 text-lg font-bold text-ink">
                {editingCategoryId ? "Actualiza el rubro seleccionado" : "Crea un rubro configurable"}
              </h3>
            </div>

            <div className="grid gap-3">
              <input
                value={categoryForm.name}
                onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Farmacia"
                className="rounded border border-black/10 bg-white px-4 py-3"
                required
              />
              <textarea
                value={categoryForm.description}
                onChange={(event) => setCategoryForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Describe el tipo de comercios que representa este rubro."
                rows={3}
                className="rounded border border-black/10 bg-white px-4 py-3"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-[100px_1fr]">
              <label className="space-y-2 text-sm font-semibold text-zinc-600">
                Color
                <input
                  type="color"
                  value={normalizeHexColor(categoryForm.color)}
                  onChange={(event) => setCategoryForm((current) => ({ ...current, color: event.target.value.toUpperCase() }))}
                  className="h-12 w-full cursor-pointer rounded border border-black/10 bg-white p-1"
                />
              </label>
              <label className="space-y-2 text-sm font-semibold text-zinc-600">
                HEX principal
                <input
                  value={categoryForm.color}
                  onChange={(event) => setCategoryForm((current) => ({ ...current, color: event.target.value.toUpperCase() }))}
                  placeholder="#FF7043"
                  className="rounded border border-black/10 bg-white px-4 py-3"
                  required
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              {suggestedColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setCategoryForm((current) => ({ ...current, color }))}
                  className="h-10 w-10 rounded border-2 transition"
                  style={{
                    backgroundColor: color,
                    borderColor: categoryForm.color === color ? "#2B2B2B" : "rgba(43, 43, 43, 0.08)"
                  }}
                  aria-label={`Usar color ${color}`}
                />
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-2 text-sm font-semibold text-zinc-600">
                Color claro opcional
                <input
                  value={categoryForm.color_light}
                  onChange={(event) =>
                    setCategoryForm((current) => ({ ...current, color_light: event.target.value.toUpperCase() }))
                  }
                  placeholder="#FBE9E7"
                  className="rounded border border-black/10 bg-white px-4 py-3"
                />
              </label>
              <label className="space-y-2 text-sm font-semibold text-zinc-600">
                Icono corto
                <input
                  value={categoryForm.icon}
                  onChange={(event) => setCategoryForm((current) => ({ ...current, icon: event.target.value }))}
                  placeholder="FX o emoji"
                  className="rounded border border-black/10 bg-white px-4 py-3"
                />
              </label>
              <label className="space-y-2 text-sm font-semibold text-zinc-600">
                Orden
                <input
                  type="number"
                  min={0}
                  value={categoryForm.sort_order}
                  onChange={(event) => setCategoryForm((current) => ({ ...current, sort_order: event.target.value }))}
                  className="rounded border border-black/10 bg-white px-4 py-3"
                />
              </label>
              <label className="flex items-center gap-3 rounded border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-zinc-700">
                <input
                  type="checkbox"
                  checked={categoryForm.is_active}
                  onChange={(event) => setCategoryForm((current) => ({ ...current, is_active: event.target.checked }))}
                />
                Rubro activo
              </label>
            </div>

            <div
              className="rounded border p-4"
              style={{
                backgroundColor: categoryPreview.colorLight,
                borderColor: hexToRgba(categoryPreview.color, 0.16)
              }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.22em]" style={{ color: categoryPreview.color }}>
                Preview
              </p>
              <div className="mt-4 flex items-center gap-3">
                <span
                  className="flex h-12 w-12 items-center justify-center rounded text-sm font-black"
                  style={{ backgroundColor: hexToRgba(categoryPreview.color, 0.14), color: categoryPreview.color }}
                >
                  {previewLabel(categoryForm.name, categoryForm.icon)}
                </span>
                <div>
                  <p className="font-bold" style={{ color: categoryPreview.color }}>
                    {categoryForm.name.trim() || "Nuevo rubro"}
                  </p>
                  <p className="text-sm text-zinc-600">
                    {categoryForm.description.trim() || "Se verá en badges, filtros y secciones destacadas."}
                  </p>
                </div>
              </div>
            </div>

            {categoryError ? <p className="rounded bg-rose-50 px-4 py-3 text-sm text-rose-700">{categoryError}</p> : null}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={categorySaving}>
                {categorySaving ? "Guardando..." : editingCategoryId ? "Actualizar rubro" : "Crear rubro"}
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

          <div className="space-y-3">
            {categories.map((category) => {
              const palette = resolveCategoryPalette(category);
              return (
                <article
                  key={category.id}
                  className="rounded border p-4 shadow-sm"
                  style={{
                    background: `linear-gradient(180deg, ${palette.colorLight}, #FFFFFF)`,
                    borderColor: hexToRgba(palette.color, 0.14)
                  }}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="flex h-10 w-10 items-center justify-center rounded text-xs font-black"
                          style={{ backgroundColor: hexToRgba(palette.color, 0.14), color: palette.color }}
                        >
                          {previewLabel(category.name, category.icon ?? "")}
                        </span>
                        <div>
                          <p className="font-bold" style={{ color: palette.color }}>
                            {category.name}
                          </p>
                          <p className="text-sm text-zinc-500">{category.description || "Sin descripcion comercial."}</p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                        <span className="rounded bg-white px-3 py-1 text-zinc-700 shadow-sm">{category.color}</span>
                        <span className="rounded bg-white px-3 py-1 text-zinc-700 shadow-sm">Orden {category.sort_order}</span>
                        <span className="rounded bg-white px-3 py-1 text-zinc-700 shadow-sm">
                          {category.is_active ? "Activo" : "Inactivo"}
                        </span>
                        {category.icon ? (
                          <span className="rounded bg-white px-3 py-1 text-zinc-700 shadow-sm">Icono {category.icon}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCategoryId(category.id);
                          setCategoryForm(toCategoryForm(category));
                          setCategoryError(null);
                        }}
                        className="rounded bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm"
                      >
                        Editar
                      </button>
                      {category.is_active ? (
                        <button
                          type="button"
                          onClick={() => void handleCategoryDeactivate(category.id)}
                          className="rounded bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700"
                        >
                          Desactivar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleCategoryReactivate(category)}
                          className="rounded bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700"
                        >
                          Reactivar
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}

            {!categories.length ? (
              <EmptyState
                title="Sin rubros configurados"
                description="Crea tu primer rubro para activar identidad visual dinámica en home, filtros y badges."
              />
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="app-panel p-5">
          <h3 className="text-lg font-bold text-ink">Identidad visual</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            La marca publica del producto queda fija como KePedimos para mantener consistencia entre landing,
            catalogo, paneles y PWA.
          </p>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
            <div className="space-y-3 text-sm text-zinc-600">
              <div className="border border-[var(--color-border-default)] bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Marca visible</p>
                <p className="mt-2 text-lg font-bold text-ink">KePedimos</p>
              </div>
              <div className="border border-[var(--color-border-default)] bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Assets</p>
                <p className="mt-2 leading-6">Wordmark, logo de navegacion y favicon usan los archivos versionados del frontend.</p>
              </div>
              <div className="border border-[var(--color-border-default)] bg-brand-50 px-4 py-3 text-brand-900">
                Los campos de carga de identidad quedan deshabilitados por decision de producto.
              </div>
            </div>
            <div className="border border-[var(--color-border-default)] bg-zinc-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Preview</p>
              <div className="mt-4 border border-[var(--color-border-default)] bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <BrandWordmark size="title" />
                  <span className="border border-[var(--color-border-default)] bg-white px-3 py-2 text-xs font-semibold text-zinc-700">
                    Ingresar
                  </span>
                </div>
              </div>
              <div className="kp-install-banner mt-4 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--kp-accent)]">Acceso</p>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 font-display text-2xl font-bold leading-tight text-ink">
                  <span>Ingresar a</span>
                  <BrandWordmark size="hero" className="min-w-0" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <form onSubmit={(event) => void handleServiceFeeSave(event)} className="rounded bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-ink">Tarifa global de servicio</h3>
          <p className="mt-2 text-sm text-zinc-600">Valor actual: {formatCurrency(platformSettings.service_fee_amount)}</p>
          <div className="mt-4 grid gap-3">
            <input
              type="number"
              min="0"
              step="0.01"
              value={serviceFee}
              onChange={(event) => setServiceFee(event.target.value)}
              className="rounded border border-black/10 bg-zinc-50 px-4 py-3"
            />
            {serviceError ? <p className="rounded bg-rose-50 px-4 py-3 text-sm text-rose-700">{serviceError}</p> : null}
            <Button type="submit" disabled={serviceSaving}>
              {serviceSaving ? "Guardando..." : "Guardar tarifa"}
            </Button>
          </div>
        </form>

        <form onSubmit={(event) => void handleCatalogBannerSave(event)} className="rounded bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-ink">Banner del catalogo cliente</h3>
          <p className="mt-2 text-sm text-zinc-600">
            Reemplaza por completo el texto de la cabecera en <code>/c</code>. Puedes definir imagen, tamano base y relacion visual
            desde esta pantalla.
          </p>
          <div className="mt-4 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <ImageAssetField
                label="Imagen del banner"
                value={catalogBannerImageUrl}
                onChange={setCatalogBannerImageUrl}
                folder="platform-banners"
                placeholder="https://..."
                description="Carga un archivo desde tu dispositivo o pega una URL. Si dejas el campo vacio, el catalogo usa el banner por defecto de la app."
                previewClassName="h-full w-full object-cover"
                previewWrapperStyle={{ aspectRatio: `${previewBannerDimensions.width} / ${previewBannerDimensions.height}` }}
                emptyLabel="Sin banner configurado"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Ancho base</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={catalogBannerWidth}
                    onChange={(event) => setCatalogBannerWidth(event.target.value)}
                    className="w-full rounded border border-black/10 bg-zinc-50 px-4 py-3"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Alto base</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={catalogBannerHeight}
                    onChange={(event) => setCatalogBannerHeight(event.target.value)}
                    className="w-full rounded border border-black/10 bg-zinc-50 px-4 py-3"
                  />
                </label>
              </div>
              <p className="text-sm text-zinc-500">
                Recomendado: {CATALOG_BANNER_RECOMMENDATION.width} x {CATALOG_BANNER_RECOMMENDATION.height} px. Relacion actual:{" "}
                {previewBannerRatio}.
              </p>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Preview</p>
              <CatalogBanner imageUrl={catalogBannerImageUrl} width={previewBannerDimensions.width} height={previewBannerDimensions.height} />
            </div>
          </div>
          {bannerError ? <p className="mt-4 rounded bg-rose-50 px-4 py-3 text-sm text-rose-700">{bannerError}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="submit" disabled={bannerSaving}>
              {bannerSaving ? "Guardando..." : "Guardar banner"}
            </Button>
            <button
              type="button"
              onClick={() => setCatalogBannerImageUrl("")}
              className="rounded bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-700"
            >
              Quitar banner
            </button>
          </div>
        </form>

      </div>

      <section className="rounded border border-[#d9e6ff] bg-[#f6f9ff] p-5 text-sm text-[#38558a] shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#6a88bf]">Liquidaciones</p>
        <h3 className="mt-2 text-lg font-bold text-ink">La operatoria se movio a su menu propio</h3>
        <p className="mt-2 leading-7">
          Revisiones de avisos, pagos manuales, auditoria y confirmaciones ahora viven en <strong>Liquidaciones</strong>
          para que Configuracion quede enfocada en rubros, branding y fee global.
        </p>
      </section>
    </div>
  );
}
