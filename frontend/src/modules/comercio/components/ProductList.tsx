import { Pencil, Trash2 } from "lucide-react";
import type { Product } from "../../../shared/types";
import { formatCurrency } from "../../../shared/utils/format";

export function ProductList({
  products,
  selectedProductId,
  onSelect,
  onEdit,
  onDelete
}: {
  products: Product[];
  selectedProductId?: number | null;
  onSelect?: (product: Product) => void;
  onEdit: (product: Product) => void;
  onDelete: (productId: number) => Promise<void>;
}) {
  const availableProducts = products.filter((product) => product.is_available).length;

  return (
    <section className="app-panel overflow-hidden p-0">
      <div className="flex flex-col gap-2 p-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Listado</p>
          <h2 className="mt-1.5 text-lg font-bold text-ink">Productos cargados</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="app-chip text-xs text-zinc-600">{products.length} productos</span>
          <span className="app-chip text-xs text-zinc-600">{availableProducts} activos</span>
        </div>
      </div>

      <div className="border-t border-[var(--color-border-default)]">
        <div className="hidden grid-cols-[minmax(240px,1.55fr)_minmax(125px,0.8fr)_96px_92px_82px_112px] gap-2 bg-zinc-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400 2xl:grid">
          <span>Producto</span>
          <span>Categoria</span>
          <span>Precio</span>
          <span>Stock</span>
          <span>Estado</span>
          <span className="text-right">Acciones</span>
        </div>

        <div className="divide-y divide-[var(--color-border-default)] xl:max-h-[calc(100vh-250px)] xl:overflow-y-auto">
          {products.map((product) => {
            const selected = product.id === selectedProductId;
            const categoryLabel = [product.product_category_name ?? "Sin categoria", product.product_subcategory_name]
              .filter(Boolean)
              .join(" / ");

            return (
              <article
                key={product.id}
                className={`grid grid-cols-[minmax(0,1fr)_auto] gap-2 p-2.5 transition 2xl:grid-cols-[minmax(240px,1.55fr)_minmax(125px,0.8fr)_96px_92px_82px_112px] 2xl:items-center 2xl:gap-2 ${
                  selected ? "bg-orange-50/70 ring-1 ring-inset ring-brand-500/25" : "bg-white hover:bg-zinc-50"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelect?.(product)}
                  className={`grid min-w-0 grid-cols-[44px_minmax(0,1fr)] gap-2 rounded text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                    onSelect ? "cursor-pointer" : "cursor-default"
                  }`}
                >
                  <span className="h-11 w-11 overflow-hidden rounded bg-zinc-100">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                    ) : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                      {product.sku}
                    </span>
                    <span className="mt-0.5 block truncate text-sm font-bold text-ink">{product.name}</span>
                    <span className="mt-0.5 block truncate text-xs text-zinc-500 2xl:hidden">{categoryLabel}</span>
                    {product.brand || product.unit_label ? (
                      <span className="mt-0.5 block truncate text-xs text-zinc-400">
                        {[product.brand, product.unit_label].filter(Boolean).join(" / ")}
                      </span>
                    ) : null}
                  </span>
                </button>

                <div className="hidden min-w-0 text-xs leading-5 text-zinc-600 2xl:block">
                  <span className="block truncate font-semibold text-zinc-700">
                    {product.product_category_name ?? "Sin categoria"}
                  </span>
                  <span className="block truncate text-zinc-400">
                    {product.product_subcategory_name ?? "Sin subcategoria"}
                  </span>
                </div>

                <div className="hidden flex-wrap items-center gap-2 2xl:block">
                  <strong className="text-sm text-ink">{formatCurrency(product.final_price)}</strong>
                  {product.has_commercial_discount ? (
                    <span className="rounded bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700 xl:mt-1 xl:inline-block">
                      -{product.commercial_discount_percentage}%
                    </span>
                  ) : null}
                </div>

                <div className="hidden text-xs font-semibold text-zinc-500 2xl:block">
                  {product.stock_quantity ?? "Sin control"}
                </div>

                <span
                  className={`hidden w-fit items-center rounded px-2.5 py-1 text-xs font-semibold 2xl:inline-flex ${
                    product.is_available ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  {product.is_available ? "Activo" : "Pausado"}
                </span>

                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    aria-label={`Editar ${product.name}`}
                    onClick={() => onEdit(product)}
                    className="inline-flex h-11 w-11 items-center justify-center rounded border border-black/5 bg-white text-zinc-700 shadow-sm transition hover:bg-zinc-50"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Eliminar ${product.name}`}
                    onClick={() => void onDelete(product.id)}
                    className="inline-flex h-11 w-11 items-center justify-center rounded bg-rose-500 text-white shadow-sm transition hover:bg-rose-600"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

                <div className="col-span-2 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-zinc-500 2xl:hidden">
                  <span className="rounded bg-zinc-100 px-2 py-1 text-ink">{formatCurrency(product.final_price)}</span>
                  {product.has_commercial_discount ? (
                    <span className="rounded bg-emerald-100 px-2 py-1 text-emerald-700">
                      -{product.commercial_discount_percentage}%
                    </span>
                  ) : null}
                  <span className="rounded bg-zinc-100 px-2 py-1">Stock: {product.stock_quantity ?? "Sin control"}</span>
                  <span className="rounded bg-zinc-100 px-2 py-1">Max. {product.max_per_order ?? "Sin limite"}</span>
                  <span
                    className={`rounded px-2 py-1 ${
                      product.is_available ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {product.is_available ? "Activo" : "Pausado"}
                  </span>
                </div>
              </article>
            );
          })}
          {!products.length ? <div className="bg-white p-4 text-sm text-zinc-500">Todavia no cargaste productos.</div> : null}
        </div>
      </div>
    </section>
  );
}
