import { Pencil, Trash2 } from "lucide-react";
import type { Product } from "../../../shared/types";
import { formatCurrency } from "../../../shared/utils/format";

export function ProductList({
  products,
  onEdit,
  onDelete
}: {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (productId: number) => Promise<void>;
}) {
  const availableProducts = products.filter((product) => product.is_available).length;

  return (
    <section className="app-panel p-4">
      <div className="flex flex-col gap-3 border-b border-[var(--color-border-default)] pb-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Listado</p>
          <h2 className="mt-1.5 text-lg font-bold text-ink">Productos cargados</h2>
          <p className="mt-1.5 text-sm leading-5 text-zinc-600">Revisa disponibilidad, stock y precio final antes de publicar cambios.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="app-chip text-xs text-zinc-600">{products.length} productos</span>
          <span className="app-chip text-xs text-zinc-600">{availableProducts} activos</span>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        {products.map((product) => (
          <article key={product.id} className="rounded border border-black/5 bg-white p-3 shadow-sm">
            <div className="flex gap-3">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded bg-zinc-100 sm:h-24 sm:w-24">
                {product.image_url ? <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">{product.sku}</p>
                    <h4 className="mt-1 font-bold text-ink">{product.name}</h4>
                    <p className="mt-1 text-sm leading-5 text-zinc-600">
                      {product.brand ? `${product.brand} · ` : ""}
                      {product.product_category_name ?? "Sin categoría"}
                      {product.product_subcategory_name ? ` / ${product.product_subcategory_name}` : ""}
                      {product.unit_label ? ` · ${product.unit_label}` : ""}
                    </p>
                  </div>
                  <span className="rounded bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600">
                    {product.is_available ? "Activo" : "Pausado"}
                  </span>
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
                  <strong className="text-base text-ink sm:text-lg">{formatCurrency(product.final_price)}</strong>
                  {product.has_commercial_discount ? (
                    <>
                      <span className="text-sm text-zinc-400 line-through">{formatCurrency(product.price)}</span>
                      <span className="rounded bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                        -{product.commercial_discount_percentage}% comercial
                      </span>
                    </>
                  ) : null}
                </div>

                <div className="mt-2.5 flex flex-wrap gap-2 text-xs font-semibold text-zinc-500">
                  <span className="rounded bg-zinc-100 px-2.5 py-1">Stock: {product.stock_quantity ?? "Sin control"}</span>
                  <span className="rounded bg-zinc-100 px-2.5 py-1">
                    Máx. por pedido: {product.max_per_order ?? "Sin límite"}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onEdit(product)}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded bg-zinc-100 px-3 text-xs font-semibold text-zinc-700"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                Editar
              </button>
              <button
                type="button"
                onClick={() => void onDelete(product.id)}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded bg-rose-500 px-3 text-xs font-semibold text-white"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Eliminar
              </button>
            </div>
          </article>
        ))}
        {!products.length ? <div className="rounded bg-white p-4 text-sm text-zinc-500 shadow-sm">Todavía no cargaste productos.</div> : null}
      </div>
    </section>
  );
}
