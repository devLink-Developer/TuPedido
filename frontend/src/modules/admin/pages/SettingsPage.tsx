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
  fetchAdminMercadoPagoProvider,
  fetchAdminSettlementNotices,
  fetchAdminSettlementPayments,
  fetchAdminSettlementStores,
  fetchPlatformSettings,
  reviewAdminSettlementNotice,
  updateAdminCategory,
  updateAdminMercadoPagoProvider,
  updatePlatformSettings
} from "../../../shared/services/api";
import type {
  AdminSettlementStore,
  Category,
  CategoryWrite,
  PaymentProviderConfig,
  PlatformSettings,
  SettlementNotice,
  SettlementPayment
} from "../../../shared/types";
import { hexToRgba, isHexColor, normalizeHexColor, resolveCategoryPalette } from "../../../shared/utils/categoryTheme";
import { formatCurrency, formatDateTime } from "../../../shared/utils/format";
import { statusLabels } from "../../../shared/utils/labels";
import { Button } from "../../../shared/ui/Button";
import { resolveApiMediaUrl } from "../../../shared/services/api/client";

type CategoryFormState = {
  name: string;
  description: string;
  color: string;
  color_light: string;
  icon: string;
  sort_order: string;
  is_active: boolean;
};

type MercadoPagoProviderFormState = {
  client_id: string;
  client_secret: string;
  webhook_secret: string;
  redirect_uri: string;
  enabled: boolean;
  mode: "sandbox" | "production";
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

const emptyMercadoPagoProviderForm: MercadoPagoProviderFormState = {
  client_id: "",
  client_secret: "",
  webhook_secret: "",
  redirect_uri: "",
  enabled: false,
  mode: "sandbox"
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

function isValidHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function SettingsPage() {
  const { token } = useAuthSession();
  const syncPublicCategories = useCategoryStore((state) => state.setCategories);
  const [categories, setCategories] = useState<Category[]>([]);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null);
  const [paymentProvider, setPaymentProvider] = useState<PaymentProviderConfig | null>(null);
  const [mercadoPagoForm, setMercadoPagoForm] = useState<MercadoPagoProviderFormState>(emptyMercadoPagoProviderForm);
  const [settlementStores, setSettlementStores] = useState<AdminSettlementStore[]>([]);
  const [settlementNotices, setSettlementNotices] = useState<SettlementNotice[]>([]);
  const [settlementPayments, setSettlementPayments] = useState<SettlementPayment[]>([]);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(emptyCategoryForm);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [serviceFee, setServiceFee] = useState("0");
  const [platformLogoUrl, setPlatformLogoUrl] = useState("");
  const [platformWordmarkUrl, setPlatformWordmarkUrl] = useState("");
  const [platformFaviconUrl, setPlatformFaviconUrl] = useState("");
  const [platformUseLogoAsFavicon, setPlatformUseLogoAsFavicon] = useState(false);
  const [catalogBannerImageUrl, setCatalogBannerImageUrl] = useState("");
  const [catalogBannerWidth, setCatalogBannerWidth] = useState(String(CATALOG_BANNER_RECOMMENDATION.width));
  const [catalogBannerHeight, setCatalogBannerHeight] = useState(String(CATALOG_BANNER_RECOMMENDATION.height));
  const [paymentForm, setPaymentForm] = useState({ store_id: "", amount: "", reference: "", notes: "" });
  const [noticeNotes, setNoticeNotes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [categorySaving, setCategorySaving] = useState(false);
  const [serviceSaving, setServiceSaving] = useState(false);
  const [providerSaving, setProviderSaving] = useState(false);
  const [providerMessage, setProviderMessage] = useState<string | null>(null);
  const [providerFieldErrors, setProviderFieldErrors] = useState<Partial<Record<keyof MercadoPagoProviderFormState, string>>>({});
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [bannerSaving, setBannerSaving] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [brandingError, setBrandingError] = useState<string | null>(null);
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
      const [noticeResult, paymentResult, categoriesResult, platformResult, paymentProviderResult, storesWithBalanceResult] = await Promise.all([
        fetchAdminSettlementNotices(token),
        fetchAdminSettlementPayments(token),
        fetchAdminCategories(token),
        fetchPlatformSettings(token),
        fetchAdminMercadoPagoProvider(token),
        fetchAdminSettlementStores(token)
      ]);
      setCategories(categoriesResult);
      syncPublicCategories(categoriesResult.filter((category) => category.is_active));
      setPlatformSettings(platformResult);
      setPaymentProvider(paymentProviderResult);
      setMercadoPagoForm({
        client_id: paymentProviderResult.client_id ?? "",
        client_secret: "",
        webhook_secret: "",
        redirect_uri: paymentProviderResult.redirect_uri ?? "",
        enabled: paymentProviderResult.enabled,
        mode: paymentProviderResult.mode
      });
      setServiceFee(platformResult.service_fee_amount.toFixed(2));
      setPlatformLogoUrl(platformResult.platform_logo_url ?? "");
      setPlatformWordmarkUrl(platformResult.platform_wordmark_url ?? "");
      setPlatformFaviconUrl(platformResult.platform_favicon_url ?? "");
      setPlatformUseLogoAsFavicon(Boolean(platformResult.platform_use_logo_as_favicon));
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

  async function handleMercadoPagoProviderSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !paymentProvider) return;
    const nextErrors: Partial<Record<keyof MercadoPagoProviderFormState, string>> = {};
    if (mercadoPagoForm.enabled) {
      if (!mercadoPagoForm.client_id.trim()) nextErrors.client_id = "El Client ID es obligatorio.";
      if (!mercadoPagoForm.client_secret.trim() && !paymentProvider.client_secret_masked) {
        nextErrors.client_secret = "El Client Secret es obligatorio.";
      }
      if (!paymentProvider.simulated && !mercadoPagoForm.webhook_secret.trim() && !paymentProvider.webhook_secret_masked) {
        nextErrors.webhook_secret = "El Webhook Secret es obligatorio para pagos reales.";
      }
      if (!mercadoPagoForm.redirect_uri.trim() || !isValidHttpUrl(mercadoPagoForm.redirect_uri.trim())) {
        nextErrors.redirect_uri = "Ingresa una URL http/https valida.";
      }
    }
    if (Object.keys(nextErrors).length) {
      setProviderFieldErrors(nextErrors);
      setProviderError("Revisa los campos marcados antes de guardar Mercado Pago.");
      return;
    }
    if (paymentProvider.enabled && !mercadoPagoForm.enabled && !window.confirm("Desactivar Mercado Pago ocultara este medio de pago para todos los comercios. Continuar?")) {
      return;
    }
    if (paymentProvider.mode !== "production" && mercadoPagoForm.mode === "production" && !window.confirm("Pasar a Produccion usara credenciales reales de Mercado Pago. Continuar?")) {
      return;
    }
    setProviderSaving(true);
    setProviderError(null);
    setProviderMessage(null);
    setProviderFieldErrors({});
    try {
      await updateAdminMercadoPagoProvider(token, {
        client_id: mercadoPagoForm.client_id.trim() || null,
        client_secret: mercadoPagoForm.client_secret.trim() || null,
        webhook_secret: mercadoPagoForm.webhook_secret.trim() || null,
        redirect_uri: mercadoPagoForm.redirect_uri.trim() || null,
        enabled: mercadoPagoForm.enabled,
        mode: mercadoPagoForm.mode
      });
      setProviderMessage("Configuracion de Mercado Pago guardada.");
      await load();
    } catch (requestError) {
      setProviderError(requestError instanceof Error ? requestError.message : "No se pudo guardar Mercado Pago");
    } finally {
      setProviderSaving(false);
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

  async function handlePlatformBrandingSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !platformSettings) return;
    setBrandingSaving(true);
    setBrandingError(null);
    try {
      await updatePlatformSettings(token, {
        service_fee_amount: platformSettings.service_fee_amount,
        platform_logo_url: platformLogoUrl.trim() || null,
        platform_wordmark_url: platformWordmarkUrl.trim() || null,
        platform_favicon_url: platformFaviconUrl.trim() || null,
        platform_use_logo_as_favicon: platformUseLogoAsFavicon
      });
      await load();
    } catch (requestError) {
      setBrandingError(requestError instanceof Error ? requestError.message : "No se pudo guardar la identidad");
    } finally {
      setBrandingSaving(false);
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
  if (error || !platformSettings || !paymentProvider) {
    return <EmptyState title="Configuracion no disponible" description={error ?? "Sin datos"} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Configuracion"
        description="Administra rubros, el fee global cobrado al comprador y la revision de liquidaciones de cuenta corriente."
      />

      <section className="rounded-[28px] bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Configuracion</p>
            <h2 className="mt-2 text-xl font-bold text-ink">Rubros</h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-zinc-600">
              Define nombre, color, icono, orden y estado. Estos cambios impactan en home, filtros y badges de comercios sin tocar codigo.
            </p>
          </div>
          <span className="rounded-full bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-600">
            {categories.filter((category) => category.is_active).length} activos / {categories.length} totales
          </span>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[420px_1fr]">
          <form
            onSubmit={(event) => void handleCategorySubmit(event)}
            className="space-y-4 rounded-[24px] border border-black/5 bg-zinc-50 p-4"
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
                className="rounded-2xl border border-black/10 bg-white px-4 py-3"
                required
              />
              <textarea
                value={categoryForm.description}
                onChange={(event) => setCategoryForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Describe el tipo de comercios que representa este rubro."
                rows={3}
                className="rounded-2xl border border-black/10 bg-white px-4 py-3"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-[100px_1fr]">
              <label className="space-y-2 text-sm font-semibold text-zinc-600">
                Color
                <input
                  type="color"
                  value={normalizeHexColor(categoryForm.color)}
                  onChange={(event) => setCategoryForm((current) => ({ ...current, color: event.target.value.toUpperCase() }))}
                  className="h-12 w-full cursor-pointer rounded-2xl border border-black/10 bg-white p-1"
                />
              </label>
              <label className="space-y-2 text-sm font-semibold text-zinc-600">
                HEX principal
                <input
                  value={categoryForm.color}
                  onChange={(event) => setCategoryForm((current) => ({ ...current, color: event.target.value.toUpperCase() }))}
                  placeholder="#FF7043"
                  className="rounded-2xl border border-black/10 bg-white px-4 py-3"
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
                  className="h-10 w-10 rounded-full border-2 transition"
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
                  className="rounded-2xl border border-black/10 bg-white px-4 py-3"
                />
              </label>
              <label className="space-y-2 text-sm font-semibold text-zinc-600">
                Icono corto
                <input
                  value={categoryForm.icon}
                  onChange={(event) => setCategoryForm((current) => ({ ...current, icon: event.target.value }))}
                  placeholder="FX o emoji"
                  className="rounded-2xl border border-black/10 bg-white px-4 py-3"
                />
              </label>
              <label className="space-y-2 text-sm font-semibold text-zinc-600">
                Orden
                <input
                  type="number"
                  min={0}
                  value={categoryForm.sort_order}
                  onChange={(event) => setCategoryForm((current) => ({ ...current, sort_order: event.target.value }))}
                  className="rounded-2xl border border-black/10 bg-white px-4 py-3"
                />
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-zinc-700">
                <input
                  type="checkbox"
                  checked={categoryForm.is_active}
                  onChange={(event) => setCategoryForm((current) => ({ ...current, is_active: event.target.checked }))}
                />
                Rubro activo
              </label>
            </div>

            <div
              className="rounded-[24px] border p-4"
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
                  className="flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-black"
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

            {categoryError ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{categoryError}</p> : null}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={categorySaving}>
                {categorySaving ? "Guardando..." : editingCategoryId ? "Actualizar rubro" : "Crear rubro"}
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

          <div className="space-y-3">
            {categories.map((category) => {
              const palette = resolveCategoryPalette(category);
              return (
                <article
                  key={category.id}
                  className="rounded-[24px] border p-4 shadow-sm"
                  style={{
                    background: `linear-gradient(180deg, ${palette.colorLight}, #FFFFFF)`,
                    borderColor: hexToRgba(palette.color, 0.14)
                  }}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="flex h-10 w-10 items-center justify-center rounded-2xl text-xs font-black"
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
                        <span className="rounded-full bg-white px-3 py-1 text-zinc-700 shadow-sm">{category.color}</span>
                        <span className="rounded-full bg-white px-3 py-1 text-zinc-700 shadow-sm">Orden {category.sort_order}</span>
                        <span className="rounded-full bg-white px-3 py-1 text-zinc-700 shadow-sm">
                          {category.is_active ? "Activo" : "Inactivo"}
                        </span>
                        {category.icon ? (
                          <span className="rounded-full bg-white px-3 py-1 text-zinc-700 shadow-sm">Icono {category.icon}</span>
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
                        className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm"
                      >
                        Editar
                      </button>
                      {category.is_active ? (
                        <button
                          type="button"
                          onClick={() => void handleCategoryDeactivate(category.id)}
                          className="rounded-full bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700"
                        >
                          Desactivar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleCategoryReactivate(category)}
                          className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700"
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

      <form onSubmit={(event) => void handleMercadoPagoProviderSave(event)} className="rounded-[28px] bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Pagos</p>
            <h3 className="mt-2 text-lg font-bold text-ink">Mercado Pago</h3>
            <p className="mt-2 max-w-2xl text-sm text-zinc-600">
              Configura una sola vez la app OAuth de Mercado Pago para que cada comercio conecte su cuenta.
            </p>
          </div>
          <div className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
            <p className="font-semibold text-ink">{paymentProvider.enabled ? "Provider activo" : "Provider inactivo"}</p>
            <p className="mt-1">Modo actual: {paymentProvider.mode === "production" ? "Produccion" : "Sandbox"}</p>
            <p className="mt-1">Secret configurado: {paymentProvider.client_secret_masked ? "Si" : "No"}</p>
            <p className="mt-1">Webhook secret: {paymentProvider.webhook_configured ? "Si" : "No"}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="space-y-2 text-sm font-semibold text-zinc-600">
            Client ID
            <input
              value={mercadoPagoForm.client_id}
              onChange={(event) =>
                setMercadoPagoForm((current) => ({
                  ...current,
                  client_id: event.target.value
                }))
              }
              className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
              placeholder="APP_USR-..."
              aria-invalid={Boolean(providerFieldErrors.client_id)}
            />
            {providerFieldErrors.client_id ? <p className="text-xs font-normal text-rose-700">{providerFieldErrors.client_id}</p> : null}
          </label>
          <label className="space-y-2 text-sm font-semibold text-zinc-600">
            <span className="flex items-center justify-between gap-3">
              Client Secret
              <button
                type="button"
                onClick={() => setShowClientSecret((current) => !current)}
                className="text-xs font-semibold text-brand-700"
                aria-label={showClientSecret ? "Ocultar Client Secret" : "Mostrar Client Secret"}
                aria-pressed={showClientSecret}
              >
                {showClientSecret ? "Ocultar" : "Mostrar"}
              </button>
            </span>
            <input
              type={showClientSecret ? "text" : "password"}
              value={mercadoPagoForm.client_secret}
              onChange={(event) =>
                setMercadoPagoForm((current) => ({
                  ...current,
                  client_secret: event.target.value
                }))
              }
              className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
              placeholder={paymentProvider.client_secret_masked ? "Dejar vacio para conservar el actual" : "Ingresa el secret"}
              aria-invalid={Boolean(providerFieldErrors.client_secret)}
            />
            {paymentProvider.client_secret_masked ? (
              <p className="text-xs font-normal text-zinc-500">Valor actual enmascarado: {paymentProvider.client_secret_masked}</p>
            ) : null}
            {providerFieldErrors.client_secret ? <p className="text-xs font-normal text-rose-700">{providerFieldErrors.client_secret}</p> : null}
          </label>
          <label className="space-y-2 text-sm font-semibold text-zinc-600">
            <span className="flex items-center justify-between gap-3">
              Webhook Secret
              <button
                type="button"
                onClick={() => setShowWebhookSecret((current) => !current)}
                className="text-xs font-semibold text-brand-700"
                aria-label={showWebhookSecret ? "Ocultar Webhook Secret" : "Mostrar Webhook Secret"}
                aria-pressed={showWebhookSecret}
              >
                {showWebhookSecret ? "Ocultar" : "Mostrar"}
              </button>
            </span>
            <input
              type={showWebhookSecret ? "text" : "password"}
              value={mercadoPagoForm.webhook_secret}
              onChange={(event) =>
                setMercadoPagoForm((current) => ({
                  ...current,
                  webhook_secret: event.target.value
                }))
              }
              className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
              placeholder={paymentProvider.webhook_secret_masked ? "Dejar vacio para conservar el actual" : "Secret de Webhooks"}
              aria-invalid={Boolean(providerFieldErrors.webhook_secret)}
            />
            {paymentProvider.webhook_secret_masked ? (
              <p className="text-xs font-normal text-zinc-500">Valor actual enmascarado: {paymentProvider.webhook_secret_masked}</p>
            ) : null}
            {providerFieldErrors.webhook_secret ? <p className="text-xs font-normal text-rose-700">{providerFieldErrors.webhook_secret}</p> : null}
          </label>
          <label className="space-y-2 text-sm font-semibold text-zinc-600 md:col-span-2">
            Redirect URI
            <input
              value={mercadoPagoForm.redirect_uri}
              onChange={(event) =>
                setMercadoPagoForm((current) => ({
                  ...current,
                  redirect_uri: event.target.value
                }))
              }
              className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
              placeholder={paymentProvider.oauth_callback_url ?? "https://.../api/v1/oauth/mercadopago/callback"}
              aria-invalid={Boolean(providerFieldErrors.redirect_uri)}
            />
            {paymentProvider.oauth_callback_url ? (
              <p className="text-xs font-normal text-zinc-500">
                Callback OAuth detectado: <span className="break-all font-mono">{paymentProvider.oauth_callback_url}</span>
              </p>
            ) : null}
            {paymentProvider.redirect_uri_internal && paymentProvider.oauth_callback_url && !paymentProvider.oauth_callback_url.includes("localhost") ? (
              <p className="rounded-2xl bg-amber-50 px-3 py-2 text-xs font-normal text-amber-800" role="alert">
                El Redirect URI actual usa localhost. Para conectar comercios desde una URL publica, guarda el callback detectado aqui y registralo igual en la app de Mercado Pago.
              </p>
            ) : null}
            {providerFieldErrors.redirect_uri ? <p className="text-xs font-normal text-rose-700">{providerFieldErrors.redirect_uri}</p> : null}
          </label>
          <div className="space-y-2 rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 md:col-span-2">
            <p className="font-semibold text-zinc-700">Webhook URL</p>
            <p className="break-all font-mono text-xs text-zinc-600">{paymentProvider.webhook_url ?? "Configura BACKEND_BASE_URL para calcularla."}</p>
            <p className="text-xs">Usa esta URL en la app de Mercado Pago para validar notificaciones con x-signature.</p>
          </div>
          <label className="space-y-2 text-sm font-semibold text-zinc-600">
            Modo
            <select
              value={mercadoPagoForm.mode}
              onChange={(event) =>
                setMercadoPagoForm((current) => ({
                  ...current,
                  mode: event.target.value as "sandbox" | "production"
                }))
              }
              className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
            >
              <option value="sandbox">Sandbox</option>
              <option value="production">Produccion</option>
            </select>
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700">
            <input
              type="checkbox"
              checked={mercadoPagoForm.enabled}
              onChange={(event) =>
                setMercadoPagoForm((current) => ({
                  ...current,
                  enabled: event.target.checked
                }))
              }
            />
            Activar Mercado Pago
          </label>
        </div>
        {providerError ? <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{providerError}</p> : null}
        {providerMessage ? <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{providerMessage}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="submit" disabled={providerSaving}>
            {providerSaving ? "Guardando..." : "Guardar Mercado Pago"}
          </Button>
        </div>
      </form>

      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={(event) => void handlePlatformBrandingSave(event)} className="rounded-[28px] bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-ink">Identidad visual</h3>
          <p className="mt-2 text-sm text-zinc-600">
            Configura los assets de marca por separado: logo de navbar, wordmark para reemplazar el texto de marca y favicon del navegador.
          </p>
          <div className="mt-4 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <ImageAssetField
                label="Logo principal / navbar"
                value={platformLogoUrl}
                onChange={setPlatformLogoUrl}
                folder="platform-branding"
                placeholder="https://..."
                description="Usa un logo horizontal o wordmark, por ejemplo logo_3, para que la marca se vea limpia y grande en el navbar."
                previewClassName="h-32 w-full object-contain bg-white p-5"
                emptyLabel="Sin logo configurado para navbar"
              />
              <ImageAssetField
                label="Wordmark / logo_3"
                value={platformWordmarkUrl}
                onChange={setPlatformWordmarkUrl}
                folder="platform-branding"
                placeholder="https://..."
                description="Esta imagen reemplaza el texto de marca en accesos, titulos y bloques donde la marca aparece inline."
                previewClassName="h-24 w-full object-contain bg-white p-4"
                emptyLabel="Sin wordmark configurado"
              />
              <ImageAssetField
                label="Favicon"
                value={platformFaviconUrl}
                onChange={setPlatformFaviconUrl}
                folder="platform-branding"
                placeholder="https://..."
                description="Se usa en la pestaña del navegador cuando no reutilizas el logo."
                previewClassName="h-32 w-full object-contain bg-white p-5"
                emptyLabel="Sin favicon configurado"
              />
              <label className="flex items-center gap-3 rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700">
                <input
                  type="checkbox"
                  checked={platformUseLogoAsFavicon}
                  onChange={(event) => setPlatformUseLogoAsFavicon(event.target.checked)}
                />
                Usar logo como favicon
              </label>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Preview</p>
              <div className="rounded-[24px] border border-black/5 bg-zinc-50 p-5">
                <div className="rounded-[22px] border border-black/5 bg-[rgba(255,251,246,0.94)] px-4 py-3 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      {platformLogoUrl ? (
                        <img src={resolveApiMediaUrl(platformLogoUrl)} alt="Logo principal" className="h-10 w-auto max-w-[12rem] object-contain" />
                      ) : (
                        <BrandWordmark brandName="Marca" wordmarkUrl={platformWordmarkUrl} size="title" textClassName="font-display text-2xl font-black tracking-tight text-[#24130e]" />
                      )}
                    </div>
                    <span className="rounded-full border border-black/10 bg-white/90 px-3 py-2 text-xs font-semibold text-zinc-700">
                      Ingresar
                    </span>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-4">
                  <div className="flex h-14 min-w-0 flex-1 items-center overflow-hidden rounded-[1.2rem] bg-white px-4 shadow-sm">
                    {platformLogoUrl ? (
                      <img src={resolveApiMediaUrl(platformLogoUrl)} alt="Logo de la app" className="h-9 w-auto max-w-full object-contain" />
                    ) : (
                      <BrandWordmark brandName="Marca" wordmarkUrl={platformWordmarkUrl} size="inline" frameClassName="w-[8.5rem]" textClassName="font-display text-xl font-black tracking-tight text-zinc-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink">Logo principal</p>
                    <p className="text-sm text-zinc-500">Asi se vera en navbar y cabeceras principales.</p>
                  </div>
                </div>
                <div className="mt-5 rounded-[22px] bg-[linear-gradient(180deg,#221816_0%,#171210_100%)] px-4 py-4 text-white">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-200">Acceso</p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 font-display text-2xl font-bold leading-tight">
                    <span>Ingresar a</span>
                    <BrandWordmark
                      brandName="Marca"
                      wordmarkUrl={platformWordmarkUrl}
                      size="hero"
                      fit="contain"
                      className="min-w-0"
                      frameClassName="h-[5.25rem] w-[15rem] sm:h-[6.5rem] sm:w-[18rem]"
                      imageClassName="drop-shadow-[0_12px_24px_rgba(249,115,22,0.28)]"
                    />
                  </div>
                </div>
                <div className="mt-5 flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm">
                    {platformUseLogoAsFavicon ? (
                      platformLogoUrl ? (
                        <img src={resolveApiMediaUrl(platformLogoUrl)} alt="Favicon resuelto" className="h-full w-full object-contain p-1.5" />
                      ) : (
                        <span className="text-[10px] font-semibold text-zinc-400">Logo</span>
                      )
                    ) : platformFaviconUrl ? (
                      <img src={resolveApiMediaUrl(platformFaviconUrl)} alt="Favicon configurado" className="h-full w-full object-contain p-1.5" />
                    ) : (
                      <span className="text-[10px] font-semibold text-zinc-400">Fav</span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink">Favicon resuelto</p>
                    <p className="text-sm text-zinc-500">
                      {platformUseLogoAsFavicon
                        ? "La app usara el logo principal como favicon."
                        : "La app usara la imagen dedicada de favicon."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {brandingError ? <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{brandingError}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="submit" disabled={brandingSaving}>
              {brandingSaving ? "Guardando..." : "Guardar identidad"}
            </Button>
          </div>
        </form>

        <form onSubmit={(event) => void handleServiceFeeSave(event)} className="rounded-[28px] bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-ink">Tarifa global de servicio</h3>
          <p className="mt-2 text-sm text-zinc-600">Valor actual: {formatCurrency(platformSettings.service_fee_amount)}</p>
          <div className="mt-4 grid gap-3">
            <input
              type="number"
              min="0"
              step="0.01"
              value={serviceFee}
              onChange={(event) => setServiceFee(event.target.value)}
              className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
            />
            {serviceError ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{serviceError}</p> : null}
            <Button type="submit" disabled={serviceSaving}>
              {serviceSaving ? "Guardando..." : "Guardar tarifa"}
            </Button>
          </div>
        </form>

        <form onSubmit={(event) => void handleCatalogBannerSave(event)} className="rounded-[28px] bg-white p-5 shadow-sm">
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
                    className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
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
                    className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
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
          {bannerError ? <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{bannerError}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="submit" disabled={bannerSaving}>
              {bannerSaving ? "Guardando..." : "Guardar banner"}
            </Button>
            <button
              type="button"
              onClick={() => setCatalogBannerImageUrl("")}
              className="rounded-full bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-700"
            >
              Quitar banner
            </button>
          </div>
        </form>

      </div>

      <section className="rounded-[28px] border border-[#d9e6ff] bg-[#f6f9ff] p-5 text-sm text-[#38558a] shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#6a88bf]">Liquidaciones</p>
        <h3 className="mt-2 text-lg font-bold text-ink">La operatoria se movio a su menu propio</h3>
        <p className="mt-2 leading-7">
          Revisiones de avisos, pagos manuales, auditoria y confirmaciones ahora viven en <strong>Liquidaciones</strong>
          para que Configuracion quede enfocada en rubros, branding, fee global y Mercado Pago.
        </p>
      </section>
    </div>
  );
}
