import { useEffect, useMemo, useState, type FormEvent } from "react";
import { EmptyState } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import {
  createMerchantPromotion,
  deleteMerchantPromotion,
  fetchMerchantProducts,
  fetchMerchantPromotions,
  updateMerchantPromotion
} from "../../../shared/services/api";
import type { MerchantPromotion, Product, PromotionWrite } from "../../../shared/types";
import { Button } from "../../../shared/ui/Button";
import { HelpTooltip } from "../../../shared/ui/HelpTooltip";
import { formatCurrency, formatDateTime } from "../../../shared/utils/format";
import { statusLabels } from "../../../shared/utils/labels";

type PromotionFormState = {
  name: string;
  description: string;
  sale_price: string;
  max_per_customer_per_day: string;
  is_active: boolean;
  sort_order: string;
  items: Array<{ product_id: string; quantity: string; sort_order: string }>;
};

const emptyForm = (): PromotionFormState => ({
  name: "",
  description: "",
  sale_price: "",
  max_per_customer_per_day: "1",
  is_active: true,
  sort_order: "0",
  items: [{ product_id: "", quantity: "1", sort_order: "0" }]
});

function toForm(promotion: MerchantPromotion): PromotionFormState {
  return {
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

export function PromoManager() {
  const { token } = useAuthSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<MerchantPromotion[]>([]);
  const [form, setForm] = useState<PromotionFormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const [productResults, promotionResults] = await Promise.all([
        fetchMerchantProducts(token),
        fetchMerchantPromotions(token)
      ]);
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
  const baseComboTotal = useMemo(
    () =>
      form.items.reduce((sum, item) => {
        const product = productMap.get(Number(item.product_id));
        return sum + (product?.final_price ?? 0) * Number(item.quantity || 0);
      }, 0),
    [form.items, productMap]
  );
  const totalSavings = Math.max(baseComboTotal - Number(form.sale_price || 0), 0);

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm());
    setFormError(null);
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setSaving(true);
    setFormError(null);

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

    if (!form.name.trim()) {
      setFormError("Ingresá un nombre para la promoción.");
      setSaving(false);
      return;
    }
    if (validItems.length === 0) {
      setFormError("Seleccioná al menos un producto para armar el combo.");
      setSaving(false);
      return;
    }
    if (repeatedProducts.size > 0) {
      setFormError("Cada producto solo puede aparecer una vez dentro del combo.");
      setSaving(false);
      return;
    }
    if (!form.sale_price || Number(form.sale_price) < 0) {
      setFormError("Definí un precio de venta válido para el combo.");
      setSaving(false);
      return;
    }
    if (Number(form.max_per_customer_per_day) <= 0) {
      setFormError("El máximo por cliente por día debe ser mayor a cero.");
      setSaving(false);
      return;
    }

    const payload: PromotionWrite = {
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
      resetForm();
      await load();
    } catch (requestError) {
      setFormError(requestError instanceof Error ? requestError.message : "No se pudo guardar la promoción");
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
      }
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo eliminar la promoción");
    }
  }

  if (loading) {
    return <div className="rounded bg-white p-5 shadow-sm">Cargando promociones...</div>;
  }

  if (!products.length) {
    return (
      <EmptyState
        title="Primero crea productos"
        description="Las promociones solo pueden armarse con productos ya configurados en el catálogo."
      />
    );
  }

  return (
    <div className="space-y-5">
      {error ? <p className="rounded bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

      <section className="app-panel p-5">
        <div className="flex flex-col gap-3 border-b border-[var(--color-border-default)] pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Combos activos</p>
            <h2 className="mt-2 text-xl font-bold text-ink">Promociones configuradas</h2>
            <p className="mt-2 text-sm text-zinc-600">Priorizá los combos activos y editá el formulario cuando necesites ajustar precio o productos.</p>
          </div>
          <span className="app-chip text-xs text-zinc-600">{promotions.length} promociones</span>
        </div>

        {promotions.length ? (
          <div className="mt-4 space-y-4">
            {promotions.map((promotion) => (
              <article key={promotion.id} className="rounded border border-black/5 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-ink">{promotion.name}</h3>
                    {promotion.description ? <p className="mt-2 text-sm text-zinc-600">{promotion.description}</p> : null}
                  </div>
                  <span className="rounded bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
                    {promotion.is_active ? "Activa" : "Pausada"}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded bg-zinc-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Precio combo</p>
                    <p className="mt-2 text-lg font-bold text-ink">{formatCurrency(promotion.sale_price)}</p>
                  </div>
                  <div className="rounded bg-zinc-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Máximo diario</p>
                    <p className="mt-2 text-lg font-bold text-ink">{promotion.max_per_customer_per_day}</p>
                  </div>
                  <div className="rounded bg-zinc-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Actualizada</p>
                    <p className="mt-2 text-sm font-semibold text-ink">{formatDateTime(promotion.updated_at)}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {promotion.items.map((item) => (
                    <span key={item.id} className="rounded bg-[#fff6ef] px-3 py-2 text-sm text-zinc-700">
                      {item.quantity} x {item.product_name}
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    className="shadow-none"
                    onClick={() => {
                      setEditingId(promotion.id);
                      setForm(toForm(promotion));
                      setFormError(null);
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    type="button"
                    className="bg-rose-600 shadow-none"
                    onClick={() => void handleDelete(promotion.id)}
                  >
                    Eliminar
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-4">
            <EmptyState title="Sin promociones" description="Crea el primer combo para empezar a ofrecer promociones reales." />
          </div>
        )}
      </section>

      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4 rounded bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Combo</p>
            <div className="mt-2 flex items-center gap-2">
              <h2 className="text-xl font-bold text-ink">{editingId === null ? "Nueva promoción" : "Editar promoción"}</h2>
              <HelpTooltip label="Ayuda sobre promoción">
                Combiná productos ya creados, definí el precio final y el límite por cliente.
              </HelpTooltip>
            </div>
          </div>
          {editingId !== null ? (
            <button
              type="button"
              onClick={resetForm}
              className="rounded bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700"
            >
              Cancelar edición
            </button>
          ) : null}
        </div>

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
            placeholder="Máximo por cliente por día"
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
            placeholder="Explicá cuándo conviene usar este combo o qué incluye."
            className="rounded border border-black/10 bg-zinc-50 px-4 py-3 md:col-span-2"
          />
        </div>

        <label className="inline-flex items-center gap-2 rounded bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
          />
          Promoción activa
        </label>

        <div className="space-y-3 rounded bg-zinc-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Productos</p>
              <div className="mt-2 flex items-center gap-2">
                <h3 className="text-lg font-bold text-ink">Configura el combo</h3>
                <HelpTooltip label="Ayuda sobre productos del combo">
                  Agregá los productos y cantidades que forman parte de la promoción.
                </HelpTooltip>
              </div>
            </div>
            <Button
              type="button"
              className="shadow-none"
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  items: [...current.items, { product_id: "", quantity: "1", sort_order: String(current.items.length) }]
                }))
              }
            >
              Agregar producto
            </Button>
          </div>
          <div className="space-y-3">
            {form.items.map((item, index) => (
              <div key={`${index}-${item.product_id}`} className="grid gap-3 rounded bg-white p-4 md:grid-cols-[1fr_120px_120px_auto]">
                <select
                  value={item.product_id}
                  onChange={(event) => updateItem(index, "product_id", event.target.value)}
                  className="rounded border border-black/10 bg-zinc-50 px-4 py-3"
                >
                  <option value="">Seleccioná un producto</option>
                  {products.map((product) => (
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
                  placeholder="Cantidad"
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
                  className="rounded bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded bg-[#fff6ef] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Base del combo</p>
            <p className="mt-2 text-lg font-bold text-ink">{formatCurrency(baseComboTotal)}</p>
          </div>
          <div className="rounded bg-[#f6fbf7] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Precio final</p>
            <p className="mt-2 text-lg font-bold text-ink">{formatCurrency(Number(form.sale_price || 0))}</p>
          </div>
          <div className="rounded bg-[#f5f7fb] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Ahorro estimado</p>
            <p className="mt-2 text-lg font-bold text-ink">{formatCurrency(totalSavings)}</p>
          </div>
        </div>

        {formError ? <p className="rounded bg-rose-50 px-4 py-3 text-sm text-rose-700">{formError}</p> : null}

        <Button type="submit" disabled={saving}>
          {saving ? "Guardando..." : editingId === null ? "Crear promoción" : "Guardar cambios"}
        </Button>
      </form>
    </div>
  );
}
