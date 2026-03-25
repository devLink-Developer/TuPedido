import { useMemo, useState, type FormEvent } from "react";
import { ImageAssetField } from "../../../shared/components";
import type { Product, ProductCategory, ProductWrite } from "../../../shared/types";
import { Button } from "../../../shared/ui/Button";
import { formatCurrency } from "../../../shared/utils/format";

type ProductFormState = {
  sku: string;
  name: string;
  brand: string;
  barcode: string;
  unit_label: string;
  description: string;
  price: string;
  compare_at_price: string;
  commercial_discount_type: "" | "percentage" | "fixed";
  commercial_discount_value: string;
  image_url: string;
  product_category_id: string;
  stock_quantity: string;
  max_per_order: string;
  is_available: boolean;
  sort_order: string;
};

function emptyProductForm(): ProductFormState {
  return {
    sku: "",
    name: "",
    brand: "",
    barcode: "",
    unit_label: "",
    description: "",
    price: "",
    compare_at_price: "",
    commercial_discount_type: "",
    commercial_discount_value: "",
    image_url: "",
    product_category_id: "",
    stock_quantity: "",
    max_per_order: "",
    is_available: true,
    sort_order: "0"
  };
}

function productToForm(product: Product): ProductFormState {
  return {
    sku: product.sku,
    name: product.name,
    brand: product.brand ?? "",
    barcode: product.barcode ?? "",
    unit_label: product.unit_label ?? "",
    description: product.description,
    price: String(product.price),
    compare_at_price: product.compare_at_price?.toString() ?? "",
    commercial_discount_type: product.commercial_discount_type ?? "",
    commercial_discount_value: product.commercial_discount_value?.toString() ?? "",
    image_url: product.image_url ?? "",
    product_category_id: product.product_category_id?.toString() ?? "",
    stock_quantity: product.stock_quantity?.toString() ?? "",
    max_per_order: product.max_per_order?.toString() ?? "",
    is_available: product.is_available,
    sort_order: String(product.sort_order)
  };
}

function buildSkuCandidate(name: string) {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();
  return normalized ? `SKU-${normalized.slice(0, 40)}` : "";
}

function toNullableNumber(value: string) {
  return value.trim() ? Number(value) : null;
}

export function ProductForm({
  categories,
  initialProduct,
  onSubmit,
  loading
}: {
  categories: ProductCategory[];
  initialProduct?: Product | null;
  onSubmit: (payload: ProductWrite) => Promise<void>;
  loading?: boolean;
}) {
  const [form, setForm] = useState<ProductFormState>(initialProduct ? productToForm(initialProduct) : emptyProductForm());
  const [error, setError] = useState<string | null>(null);

  const pricePreview = useMemo(() => {
    const basePrice = Number(form.price || 0);
    if (!Number.isFinite(basePrice) || basePrice <= 0) {
      return 0;
    }
    const discountValue = Number(form.commercial_discount_value || 0);
    if (!form.commercial_discount_type || !Number.isFinite(discountValue) || discountValue <= 0) {
      return basePrice;
    }
    if (form.commercial_discount_type === "percentage") {
      return Math.max(basePrice - (basePrice * discountValue) / 100, 0);
    }
    return Math.max(basePrice - discountValue, 0);
  }, [form.commercial_discount_type, form.commercial_discount_value, form.price]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!form.sku.trim()) {
      setError("El SKU es obligatorio.");
      return;
    }
    if (!form.name.trim()) {
      setError("El nombre del producto es obligatorio.");
      return;
    }
    if (!form.description.trim()) {
      setError("La descripcion del producto es obligatoria.");
      return;
    }
    if (!form.price.trim() || Number(form.price) < 0) {
      setError("Ingresa un precio valido.");
      return;
    }
    if (!form.product_category_id) {
      setError("Selecciona una categoria para ordenar mejor el catalogo.");
      return;
    }
    if (form.commercial_discount_type && !form.commercial_discount_value.trim()) {
      setError("Completa el valor del descuento comercial.");
      return;
    }

    try {
      await onSubmit({
        sku: form.sku.trim(),
        name: form.name.trim(),
        brand: form.brand.trim() || null,
        barcode: form.barcode.trim() || null,
        unit_label: form.unit_label.trim() || null,
        description: form.description.trim(),
        price: Number(form.price),
        compare_at_price: toNullableNumber(form.compare_at_price),
        commercial_discount_type: form.commercial_discount_type || null,
        commercial_discount_value: toNullableNumber(form.commercial_discount_value),
        image_url: form.image_url.trim() || null,
        product_category_id: Number(form.product_category_id),
        stock_quantity: toNullableNumber(form.stock_quantity),
        max_per_order: toNullableNumber(form.max_per_order),
        is_available: form.is_available,
        sort_order: Number(form.sort_order || 0)
      });
      setForm(emptyProductForm());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo guardar el producto");
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5 rounded-[28px] bg-white p-5 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Catalogo</p>
        <h3 className="mt-2 text-2xl font-bold text-ink">{initialProduct ? "Editar producto" : "Nuevo producto"}</h3>
        <p className="mt-2 text-sm text-zinc-600">
          Carga informacion comercial real: identificacion, precio de lista, descuento, stock e imagen.
        </p>
      </div>

      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Identidad</p>
          <h4 className="mt-2 text-lg font-bold text-ink">Datos comerciales</h4>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Nombre del producto"
            className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
          />
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-semibold text-ink">SKU</label>
              <button
                type="button"
                onClick={() => setForm((current) => ({ ...current, sku: buildSkuCandidate(current.name) || current.sku }))}
                className="text-xs font-semibold text-brand-600"
              >
                Generar
              </button>
            </div>
            <input
              value={form.sku}
              onChange={(event) => setForm((current) => ({ ...current, sku: event.target.value.toUpperCase() }))}
              placeholder="SKU-0001"
              className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
            />
          </div>
          <input
            value={form.brand}
            onChange={(event) => setForm((current) => ({ ...current, brand: event.target.value }))}
            placeholder="Marca"
            className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
          />
          <input
            value={form.barcode}
            onChange={(event) => setForm((current) => ({ ...current, barcode: event.target.value }))}
            placeholder="Codigo de barras"
            className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
          />
          <input
            value={form.unit_label}
            onChange={(event) => setForm((current) => ({ ...current, unit_label: event.target.value }))}
            placeholder="Presentacion, ej. 500 g / 1 L"
            className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
          />
          <select
            value={form.product_category_id}
            onChange={(event) => setForm((current) => ({ ...current, product_category_id: event.target.value }))}
            className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
          >
            <option value="">Selecciona una categoria</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <textarea
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            rows={5}
            placeholder="Descripcion comercial y detalles utiles para el cliente"
            className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 md:col-span-2"
          />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Precio</p>
          <h4 className="mt-2 text-lg font-bold text-ink">Precio y descuento comercial</h4>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.price}
            onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
            placeholder="Precio de lista"
            className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.compare_at_price}
            onChange={(event) => setForm((current) => ({ ...current, compare_at_price: event.target.value }))}
            placeholder="Precio de referencia opcional"
            className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
          />
          <select
            value={form.commercial_discount_type}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                commercial_discount_type: event.target.value as ProductFormState["commercial_discount_type"]
              }))
            }
            className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
          >
            <option value="">Sin descuento comercial</option>
            <option value="percentage">Porcentaje</option>
            <option value="fixed">Monto fijo</option>
          </select>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.commercial_discount_value}
            disabled={!form.commercial_discount_type}
            onChange={(event) => setForm((current) => ({ ...current, commercial_discount_value: event.target.value }))}
            placeholder={form.commercial_discount_type === "percentage" ? "Porcentaje" : "Monto del descuento"}
            className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 disabled:bg-zinc-100"
          />
        </div>
        <div className="rounded-[24px] border border-black/5 bg-zinc-50 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Precio final al cliente</p>
          <p className="mt-2 text-2xl font-black text-ink">{formatCurrency(pricePreview)}</p>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Operacion</p>
          <h4 className="mt-2 text-lg font-bold text-ink">Disponibilidad y limites</h4>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            type="number"
            min="0"
            value={form.stock_quantity}
            onChange={(event) => setForm((current) => ({ ...current, stock_quantity: event.target.value }))}
            placeholder="Stock controlado opcional"
            className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
          />
          <input
            type="number"
            min="1"
            value={form.max_per_order}
            onChange={(event) => setForm((current) => ({ ...current, max_per_order: event.target.value }))}
            placeholder="Maximo por pedido"
            className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
          />
          <input
            type="number"
            min="0"
            value={form.sort_order}
            onChange={(event) => setForm((current) => ({ ...current, sort_order: event.target.value }))}
            placeholder="Orden"
            className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
          />
          <label className="flex items-center gap-2 rounded-2xl bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700">
            <input
              type="checkbox"
              checked={form.is_available}
              onChange={(event) => setForm((current) => ({ ...current, is_available: event.target.checked }))}
            />
            Disponible para la venta
          </label>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Imagen</p>
          <h4 className="mt-2 text-lg font-bold text-ink">Imagen del producto</h4>
        </div>
        <ImageAssetField
          label="Imagen principal"
          value={form.image_url}
          onChange={(value) => setForm((current) => ({ ...current, image_url: value }))}
          folder="products"
          description="Puedes pegar una URL o subir una imagen desde tu dispositivo."
        />
      </section>

      {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Guardando..." : initialProduct ? "Actualizar producto" : "Crear producto"}
      </Button>
    </form>
  );
}
