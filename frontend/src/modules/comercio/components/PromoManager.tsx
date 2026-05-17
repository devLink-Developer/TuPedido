import { BadgePercent, Layers3, PackagePlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { EmptyState } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import {
  createMerchantPromotion,
  deleteMerchantPromotion,
  fetchMerchantProductCategories,
  fetchMerchantProducts,
  fetchMerchantPromotions,
  updateMerchantPromotion
} from "../../../shared/services/api";
import type { MerchantPromotion, Product, ProductCategory, PromotionWrite } from "../../../shared/types";
import { Button } from "../../../shared/ui/Button";
import { HelpTooltip } from "../../../shared/ui/HelpTooltip";
import { formatCurrency, formatDateTime } from "../../../shared/utils/format";

type PromotionFormState = {
  product_category_id: string;
  name: string;
  description: string;
  sale_price: string;
  max_per_customer_per_day: string;
  is_active: boolean;
  sort_order: string;
  items: Array<{ product_id: string; quantity: string; sort_order: string }>;
};

const UNCATEGORIZED_CATEGORY_ID = "__uncategorized__";

export type PromoManagerSummary = {
  total: number;
  active: number;
  paused: number;
  products: number;
  categories: number;
};

const emptyForm = (categoryId = ""): PromotionFormState => ({
  product_category_id: categoryId,
  name: "",
  description: "",
  sale_price: "",
  max_per_customer_per_day: "1",
  is_active: true,
  sort_order: "0",
  items: [{ product_id: "", quantity: "1", sort_order: "0" }]
});

function categoryIdForPromotion(promotion: MerchantPromotion, productMap: Map<number, Product>) {
  if (promotion.product_category_id !== null && promotion.product_category_id !== undefined) {
    return String(promotion.product_category_id);
  }
  const categoryIds = new Set(
    promotion.items
      .map((item) => productMap.get(item.product_id)?.product_category_id)
      .filter((categoryId): categoryId is number => typeof categoryId === "number")
  );
  return categoryIds.size === 1 ? String(Array.from(categoryIds)[0]) : UNCATEGORIZED_CATEGORY_ID;
}

function toForm(promotion: MerchantPromotion, fallbackCategoryId = ""): PromotionFormState {
  return {
    product_category_id:
      promotion.product_category_id !== null && promotion.product_category_id !== undefined
        ? String(promotion.product_category_id)
        : fallbackCategoryId,
    name: promotion.name,
    description: promotion.description ?? "",
    sale_price: String(promotion.sale_price),
    max_per_customer_per_day: String(promotion.max_per_customer_per_day),
    is_active: promotion.is_active,
    sort_order: String(promotion.sort_order),
    items: promotion.items.map((item) => ({
      product_id: String(item.product_id),
      quantity: String(item.quantity),
      sort_order: String(item.sort_order)
    }))
  };
}

export function PromoManager({ onSummaryChange }: { onSummaryChange?: (summary: PromoManagerSummary) => void }) {
  const { token } = useAuthSession();
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<MerchantPromotion[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState("");
  const [form, setForm] = useState<PromotionFormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function load() {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [categoryResults, productResults, promotionResults] = await Promise.all([
        fetchMerchantProductCategories(token),
        fetchMerchantProducts(token),
        fetchMerchantPromotions(token)
      ]);
      setCategories(categoryResults);
      setProducts(productResults);
      setPromotions(promotionResults);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudieron cargar las promociones");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const categoryProductCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const product of products) {
      if (product.product_category_id !== null) {
        counts.set(product.product_category_id, (counts.get(product.product_category_id) ?? 0) + 1);
      }
    }
    return counts;
  }, [products]);

  const promotionsByCategory = useMemo(() => {
    const grouped = new Map<string, MerchantPromotion[]>();
    for (const promotion of promotions) {
      const categoryId = categoryIdForPromotion(promotion, productMap);
      grouped.set(categoryId, [...(grouped.get(categoryId) ?? []), promotion]);
    }
    return grouped;
  }, [productMap, promotions]);

  const activeCategory = categories.find((category) => String(category.id) === activeCategoryId) ?? null;
  const uncategorizedPromotions = promotionsByCategory.get(UNCATEGORIZED_CATEGORY_ID) ?? [];
  const uncategorizedProductCount = products.filter((product) => product.product_category_id === null).length;
  const activePromotions = promotionsByCategory.get(activeCategoryId) ?? [];
  const activeProducts =
    activeCategoryId === UNCATEGORIZED_CATEGORY_ID
      ? products.filter((product) => product.product_category_id === null)
      : products.filter((product) => String(product.product_category_id ?? "") === activeCategoryId);
  const activeCategoryLabel =
    activeCategory?.name ??
    (activeCategoryId === UNCATEGORIZED_CATEGORY_ID && uncategorizedPromotions.length
      ? "Sin categoria asignada"
      : "Selecciona una categoria");
  const formCategory = categories.find((category) => String(category.id) === form.product_category_id) ?? null;
  const availableProducts = products.filter((product) => String(product.product_category_id ?? "") === form.product_category_id);

  const baseComboTotal = useMemo(
    () =>
      form.items.reduce((sum, item) => {
        const product = productMap.get(Number(item.product_id));
        return sum + (product?.final_price ?? 0) * Number(item.quantity || 0);
      }, 0),
    [form.items, productMap]
  );
  const totalSavings = Math.max(baseComboTotal - Number(form.sale_price || 0), 0);

  useEffect(() => {
    onSummaryChange?.({
      total: promotions.length,
      active: promotions.filter((promotion) => promotion.is_active).length,
      paused: promotions.filter((promotion) => !promotion.is_active).length,
      products: products.length,
      categories: categories.length
    });
  }, [categories.length, onSummaryChange, products.length, promotions]);

  useEffect(() => {
    if (!categories.length) return;
    if (
      activeCategoryId &&
      (activeCategoryId === UNCATEGORIZED_CATEGORY_ID || categories.some((category) => String(category.id) === activeCategoryId))
    ) {
      return;
    }
    const preferred = categories.find((category) => (categoryProductCounts.get(category.id) ?? 0) > 0) ?? categories[0];
    const nextCategoryId = String(preferred.id);
    setActiveCategoryId(nextCategoryId);
    setForm((current) => (current.product_category_id || editingId !== null ? current : emptyForm(nextCategoryId)));
  }, [activeCategoryId, categories, categoryProductCounts, editingId]);

  function resetForm(categoryId = activeCategoryId) {
    setEditingId(null);
    setForm(emptyForm(categoryId === UNCATEGORIZED_CATEGORY_ID ? "" : categoryId));
    setFormError(null);
  }

  function defaultCreateCategoryId() {
    if (activeCategoryId && activeCategoryId !== UNCATEGORIZED_CATEGORY_ID) {
      return activeCategoryId;
    }
    const preferred = categories.find((category) => (categoryProductCounts.get(category.id) ?? 0) > 0) ?? categories[0];
    return preferred ? String(preferred.id) : "";
  }

  function openCreateForm() {
    const categoryId = defaultCreateCategoryId();
    setEditingId(null);
    setForm(emptyForm(categoryId));
    setFormError(null);
    if (categoryId) {
      setActiveCategoryId(categoryId);
    }
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
    resetForm();
  }

  function selectCategory(categoryId: string) {
    setActiveCategoryId(categoryId);
    if (editingId === null) {
      resetForm(categoryId);
    }
  }

  function setFormCategory(categoryId: string) {
    setForm((current) => ({
      ...current,
      product_category_id: categoryId,
      items: [{ product_id: "", quantity: "1", sort_order: "0" }]
    }));
  }

  function updateItem(index: number, field: "product_id" | "quantity" | "sort_order", value: string) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item))
    }));
  }

  function removeItem(index: number) {
    setForm((current) => ({
      ...current,
      items: current.items.filter((_, itemIndex) => itemIndex !== index)
    }));
  }

  function startEditing(promotion: MerchantPromotion) {
    const categoryId = categoryIdForPromotion(promotion, productMap);
    if (categoryId) setActiveCategoryId(categoryId);
    setEditingId(promotion.id);
    setForm(toForm(promotion, categoryId === UNCATEGORIZED_CATEGORY_ID ? "" : categoryId));
    setFormError(null);
    setFormOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setSaving(true);
    setFormError(null);

    const selectedCategoryId = Number(form.product_category_id);
    const validItems = form.items.filter((item) => item.product_id && Number(item.quantity) > 0);
    const repeatedProducts = new Set<number>();
    const seenProducts = new Set<number>();
    for (const item of validItems) {
      const productId = Number(item.product_id);
      if (seenProducts.has(productId)) {
        repeatedProducts.add(productId);
      }
      seenProducts.add(productId);
    }

    if (!form.product_category_id || !Number.isFinite(selectedCategoryId)) {
      setFormError("Selecciona una categoria para la promocion.");
      setSaving(false);
      return;
    }
    if (!form.name.trim()) {
      setFormError("Ingresa un nombre para la promocion.");
      setSaving(false);
      return;
    }
    if (validItems.length === 0) {
      setFormError("Selecciona al menos un producto de la categoria.");
      setSaving(false);
      return;
    }
    if (validItems.some((item) => productMap.get(Number(item.product_id))?.product_category_id !== selectedCategoryId)) {
      setFormError("Todos los productos de la promocion deben pertenecer a la categoria seleccionada.");
      setSaving(false);
      return;
    }
    if (repeatedProducts.size > 0) {
      setFormError("Cada producto solo puede aparecer una vez dentro del combo.");
      setSaving(false);
      return;
    }
    if (!form.sale_price || Number(form.sale_price) < 0) {
      setFormError("Define un precio de venta valido para el combo.");
      setSaving(false);
      return;
    }
    if (Number(form.max_per_customer_per_day) <= 0) {
      setFormError("El maximo por cliente por dia debe ser mayor a cero.");
      setSaving(false);
      return;
    }

    const payload: PromotionWrite = {
      product_category_id: selectedCategoryId,
      name: form.name.trim(),
      description: form.description.trim() || null,
      sale_price: Number(form.sale_price),
      max_per_customer_per_day: Number(form.max_per_customer_per_day),
      is_active: form.is_active,
      sort_order: Number(form.sort_order || 0),
      items: validItems.map((item, index) => ({
        product_id: Number(item.product_id),
        quantity: Number(item.quantity),
        sort_order: Number(item.sort_order || index)
      }))
    };

    try {
      if (editingId === null) {
        await createMerchantPromotion(token, payload);
      } else {
        await updateMerchantPromotion(token, editingId, payload);
      }
      resetForm(String(selectedCategoryId));
      setActiveCategoryId(String(selectedCategoryId));
      setFormOpen(false);
      await load();
    } catch (requestError) {
      setFormError(requestError instanceof Error ? requestError.message : "No se pudo guardar la promocion");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(promotionId: number) {
    if (!token) return;
    try {
      await deleteMerchantPromotion(token, promotionId);
      if (editingId === promotionId) {
        resetForm();
        setFormOpen(false);
      }
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo eliminar la promocion");
    }
  }

  useEffect(() => {
    if (!formOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeForm();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [formOpen, saving]);

  const promotionForm = (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3 rounded bg-white p-3 shadow-sm md:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Combo</p>
          <div className="mt-2 flex items-center gap-2">
            <h2 id="promotion-form-title" className="text-lg font-bold text-ink">
              {editingId === null ? "Nueva promocion" : "Editar promocion"}
            </h2>
            <HelpTooltip label="Ayuda sobre promocion">
              La categoria limita los productos disponibles y mantiene ordenado el catalogo promocional.
            </HelpTooltip>
          </div>
        </div>
        <button
          type="button"
          onClick={closeForm}
          className="kp-soft-action inline-flex min-h-10 items-center gap-2 px-4 py-2 text-sm"
          aria-label="Cerrar formulario de promocion"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          Cerrar
        </button>
      </div>

      <label className="block text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">
        Categoria
        <select
          value={form.product_category_id}
          onChange={(event) => setFormCategory(event.target.value)}
          className="mt-1 min-h-11 w-full rounded border border-black/10 bg-zinc-50 px-4 py-3 text-sm font-semibold normal-case tracking-normal text-ink"
        >
          <option value="">Selecciona una categoria</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <input
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          placeholder="Ej. Combo desayuno"
          className="rounded border border-black/10 bg-zinc-50 px-4 py-3"
        />
        <input
          type="number"
          min={0}
          step="0.01"
          value={form.sale_price}
          onChange={(event) => setForm((current) => ({ ...current, sale_price: event.target.value }))}
          placeholder="Precio final del combo"
          className="rounded border border-black/10 bg-zinc-50 px-4 py-3"
        />
        <input
          type="number"
          min={1}
          value={form.max_per_customer_per_day}
          onChange={(event) => setForm((current) => ({ ...current, max_per_customer_per_day: event.target.value }))}
          placeholder="Maximo por cliente por dia"
          className="rounded border border-black/10 bg-zinc-50 px-4 py-3"
        />
        <input
          type="number"
          min={0}
          value={form.sort_order}
          onChange={(event) => setForm((current) => ({ ...current, sort_order: event.target.value }))}
          placeholder="Orden"
          className="rounded border border-black/10 bg-zinc-50 px-4 py-3"
        />
        <textarea
          value={form.description}
          onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          rows={3}
          placeholder="Explica que incluye el combo."
          className="rounded border border-black/10 bg-zinc-50 px-4 py-3 md:col-span-2"
        />
      </div>

      <label className="inline-flex min-h-10 items-center gap-2 rounded bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700">
        <input
          type="checkbox"
          checked={form.is_active}
          onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
        />
        Promocion activa
      </label>

      <div className="space-y-3 rounded bg-zinc-50 p-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Productos</p>
            <div className="mt-2 flex items-center gap-2">
              <h3 className="text-base font-bold text-ink">{formCategory?.name ?? "Selecciona categoria"}</h3>
              <HelpTooltip label="Ayuda sobre productos del combo">
                Solo se muestran productos de la categoria elegida.
              </HelpTooltip>
            </div>
          </div>
          <Button
            type="button"
            className="shadow-none"
            disabled={!form.product_category_id || !availableProducts.length}
            onClick={() =>
              setForm((current) => ({
                ...current,
                items: [...current.items, { product_id: "", quantity: "1", sort_order: String(current.items.length) }]
              }))
            }
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Agregar
          </Button>
        </div>

        {!availableProducts.length ? (
          <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Esta categoria todavia no tiene productos cargados.
          </p>
        ) : null}

        <div className="space-y-3">
          {form.items.map((item, index) => (
            <div key={`${index}-${item.product_id}`} className="grid gap-2 rounded bg-white p-2.5 md:grid-cols-[minmax(0,1fr)_96px_86px_auto]">
              <select
                value={item.product_id}
                onChange={(event) => updateItem(index, "product_id", event.target.value)}
                disabled={!form.product_category_id}
                className="min-w-0 rounded border border-black/10 bg-zinc-50 px-4 py-3"
              >
                <option value="">Selecciona un producto</option>
                {availableProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} | {formatCurrency(product.final_price)}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={item.quantity}
                onChange={(event) => updateItem(index, "quantity", event.target.value)}
                placeholder="Cant."
                className="rounded border border-black/10 bg-zinc-50 px-4 py-3"
              />
              <input
                type="number"
                min={0}
                value={item.sort_order}
                onChange={(event) => updateItem(index, "sort_order", event.target.value)}
                placeholder="Orden"
                className="rounded border border-black/10 bg-zinc-50 px-4 py-3"
              />
              <button
                type="button"
                onClick={() => removeItem(index)}
                disabled={form.items.length === 1}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded bg-rose-50 px-3 py-3 text-sm font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Quitar
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <div className="rounded bg-[#fff6ef] p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Base</p>
          <p className="mt-2 text-lg font-bold text-ink">{formatCurrency(baseComboTotal)}</p>
        </div>
        <div className="rounded bg-[#f6fbf7] p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Final</p>
          <p className="mt-2 text-lg font-bold text-ink">{formatCurrency(Number(form.sale_price || 0))}</p>
        </div>
        <div className="rounded bg-[#f5f7fb] p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Ahorro</p>
          <p className="mt-2 text-lg font-bold text-ink">{formatCurrency(totalSavings)}</p>
        </div>
      </div>

      {formError ? <p className="rounded bg-rose-50 px-4 py-3 text-sm text-rose-700">{formError}</p> : null}

      <Button type="submit" disabled={saving} className="w-full justify-center">
        {saving ? (
          "Guardando..."
        ) : (
          <>
            {editingId === null ? <PackagePlus className="h-4 w-4" aria-hidden="true" /> : <BadgePercent className="h-4 w-4" aria-hidden="true" />}
            {editingId === null ? "Crear promocion" : "Guardar cambios"}
          </>
        )}
      </Button>
    </form>
  );

  if (loading) {
    return <div className="rounded bg-white p-4 shadow-sm">Cargando promociones...</div>;
  }

  if (!categories.length) {
    return (
      <EmptyState
        title="Primero crea categorias"
        description="Las promociones se configuran dentro de una categoria del catalogo."
      />
    );
  }

  if (!products.length) {
    return (
      <EmptyState
        title="Primero crea productos"
        description="Las promociones solo pueden armarse con productos ya configurados en el catalogo."
      />
    );
  }

  return (
    <>
      <div className="grid gap-3 xl:grid-cols-[260px_minmax(0,1fr)] xl:items-start">
        {error ? <p className="rounded bg-rose-50 px-4 py-3 text-sm text-rose-700 xl:col-span-2">{error}</p> : null}

      <aside className="app-panel p-3 xl:sticky xl:top-3">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded border border-[rgba(255,106,26,0.2)] bg-[var(--kp-accent-soft)] text-[var(--kp-accent)]">
            <Layers3 className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Categorias</p>
            <h2 className="text-base font-bold text-ink">Promos por rubro</h2>
          </div>
        </div>
        <div className="mt-3 grid gap-2">
          {categories.map((category) => {
            const categoryId = String(category.id);
            const selected = categoryId === activeCategoryId;
            const categoryPromotions = promotionsByCategory.get(categoryId) ?? [];
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => selectCategory(categoryId)}
                className={`rounded border p-3 text-left transition ${
                  selected
                    ? "border-[var(--kp-accent)] bg-[#fff6ef] shadow-sm"
                    : "border-[var(--kp-stroke)] bg-white hover:border-[rgba(255,106,26,0.35)]"
                }`}
              >
                <span className="block text-sm font-bold text-ink">{category.name}</span>
                <span className="mt-1 block text-xs text-zinc-500">
                  {categoryPromotions.length} promos / {categoryProductCounts.get(category.id) ?? 0} productos
                </span>
              </button>
            );
          })}
          {uncategorizedPromotions.length ? (
            <button
              type="button"
              onClick={() => selectCategory(UNCATEGORIZED_CATEGORY_ID)}
              className={`rounded border p-3 text-left transition ${
                activeCategoryId === UNCATEGORIZED_CATEGORY_ID
                  ? "border-amber-500 bg-amber-50 shadow-sm"
                  : "border-[var(--kp-stroke)] bg-white hover:border-amber-300"
              }`}
            >
              <span className="block text-sm font-bold text-ink">Sin categoria</span>
              <span className="mt-1 block text-xs text-zinc-500">
                {uncategorizedPromotions.length} promos / {uncategorizedProductCount} productos
              </span>
            </button>
          ) : null}
        </div>
      </aside>

      <section className="app-panel min-w-0 p-3">
        <div className="flex flex-col gap-2 border-b border-[var(--color-border-default)] pb-2 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Categoria activa</p>
            <h2 className="mt-1.5 truncate text-lg font-bold text-ink">{activeCategoryLabel}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="app-chip text-xs text-zinc-600">
              {activePromotions.length} promociones / {activeProducts.length} productos
            </span>
            <Button type="button" className="min-h-10 px-4 py-2 text-sm shadow-none" onClick={openCreateForm}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nueva promocion
            </Button>
          </div>
        </div>

        {activePromotions.length ? (
          <div className="mt-3 grid gap-2">
            {activePromotions.map((promotion) => (
              <article key={promotion.id} className="rounded border border-black/5 bg-white p-3 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-ink">{promotion.name}</h3>
                      <span className="rounded bg-[#fff6ef] px-2 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--kp-accent)]">
                        {promotion.product_category_name ?? activeCategoryLabel}
                      </span>
                    </div>
                    {promotion.description ? <p className="mt-1 text-sm text-zinc-600">{promotion.description}</p> : null}
                  </div>
                  <span
                    className={`rounded px-3 py-1 text-xs font-semibold ${
                      promotion.is_active ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {promotion.is_active ? "Activa" : "Pausada"}
                  </span>
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  <div className="rounded bg-zinc-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Precio combo</p>
                    <p className="mt-2 text-lg font-bold text-ink">{formatCurrency(promotion.sale_price)}</p>
                  </div>
                  <div className="rounded bg-zinc-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Maximo diario</p>
                    <p className="mt-2 text-lg font-bold text-ink">{promotion.max_per_customer_per_day}</p>
                  </div>
                  <div className="rounded bg-zinc-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Actualizada</p>
                    <p className="mt-2 text-sm font-semibold text-ink">{formatDateTime(promotion.updated_at)}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {promotion.items.map((item) => (
                    <span key={item.id} className="rounded bg-[#fff6ef] px-3 py-2 text-sm text-zinc-700">
                      {item.quantity} x {item.product_name}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" className="shadow-none" onClick={() => startEditing(promotion)}>
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Editar
                  </Button>
                  <Button type="button" className="bg-rose-600 shadow-none" onClick={() => void handleDelete(promotion.id)}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Eliminar
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-3">
            <EmptyState title="Sin promociones en esta categoria" description="Crea un combo para esta categoria y se mostrara en este bloque." />
          </div>
        )}
      </section>

      </div>

      {formOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-[rgba(92,52,24,0.24)] p-4 backdrop-blur-[2px] md:items-center"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeForm();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="promotion-form-title"
            className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded bg-[linear-gradient(180deg,#fcf6ef_0%,#fffdfa_100%)] p-3 shadow-[0_32px_80px_rgba(24,19,18,0.28)] md:p-4"
          >
            {promotionForm}
          </div>
        </div>
      ) : null}
    </>
  );
}
