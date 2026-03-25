import { useState, type FormEvent } from "react";
import type { Product, ProductCategory } from "../../../shared/types";
import { Button } from "../../../shared/ui/Button";

type ProductFormState = {
  name: string;
  description: string;
  price: number;
  compare_at_price: string;
  image_url: string;
  product_category_id: string;
  is_available: boolean;
  sort_order: number;
};

export function ProductForm({
  categories,
  initialProduct,
  onSubmit,
  loading
}: {
  categories: ProductCategory[];
  initialProduct?: Product | null;
  onSubmit: (payload: {
    name: string;
    description: string;
    price: number;
    compare_at_price: number | null;
    image_url: string | null;
    product_category_id: number | null;
    is_available: boolean;
    sort_order: number;
  }) => Promise<void>;
  loading?: boolean;
}) {
  const [form, setForm] = useState<ProductFormState>({
    name: initialProduct?.name ?? "",
    description: initialProduct?.description ?? "",
    price: initialProduct?.price ?? 0,
    compare_at_price: initialProduct?.compare_at_price?.toString() ?? "",
    image_url: initialProduct?.image_url ?? "",
    product_category_id: initialProduct?.product_category_id?.toString() ?? "",
    is_available: initialProduct?.is_available ?? true,
    sort_order: initialProduct?.sort_order ?? 0
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({
      name: form.name,
      description: form.description,
      price: form.price,
      compare_at_price: form.compare_at_price ? Number(form.compare_at_price) : null,
      image_url: form.image_url || null,
      product_category_id: form.product_category_id ? Number(form.product_category_id) : null,
      is_available: form.is_available,
      sort_order: form.sort_order
    });
    setForm({
      name: "",
      description: "",
      price: 0,
      compare_at_price: "",
      image_url: "",
      product_category_id: "",
      is_available: true,
      sort_order: 0
    });
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4 rounded-[28px] bg-white p-5 shadow-sm">
      <h3 className="text-lg font-bold">{initialProduct ? "Editar producto" : "Nuevo producto"}</h3>
      <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Nombre" className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
      <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={4} placeholder="Descripción" className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
      <div className="grid gap-3 md:grid-cols-2">
        <input type="number" value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.currentTarget.valueAsNumber || 0 }))} placeholder="Precio" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
        <input type="number" value={form.compare_at_price} onChange={(event) => setForm((current) => ({ ...current, compare_at_price: event.target.value }))} placeholder="Precio anterior" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
        <input value={form.image_url} onChange={(event) => setForm((current) => ({ ...current, image_url: event.target.value }))} placeholder="Imagen URL" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
        <input type="number" value={form.sort_order} onChange={(event) => setForm((current) => ({ ...current, sort_order: event.currentTarget.valueAsNumber || 0 }))} placeholder="Orden" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
      </div>
      <select value={form.product_category_id} onChange={(event) => setForm((current) => ({ ...current, product_category_id: event.target.value }))} className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3">
        <option value="">Sin categoría</option>
        {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
      </select>
      <label className="flex items-center gap-2 text-sm font-semibold text-zinc-700">
        <input type="checkbox" checked={form.is_available} onChange={(event) => setForm((current) => ({ ...current, is_available: event.target.checked }))} />
        Disponible
      </label>
      <Button type="submit" disabled={loading}>{loading ? "Guardando..." : initialProduct ? "Actualizar" : "Crear"}</Button>
    </form>
  );
}
