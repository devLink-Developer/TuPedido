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
  return (
    <div className="space-y-3">
      {products.map((product) => (
        <article key={product.id} className="rounded-[28px] bg-white p-5 shadow-sm">
          <div className="flex gap-4">
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-[22px] bg-zinc-100">
              {product.image_url ? <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" /> : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">{product.sku}</p>
                  <h4 className="mt-1 font-bold text-ink">{product.name}</h4>
                  <p className="mt-1 text-sm text-zinc-600">
                    {product.brand ? `${product.brand} · ` : ""}
                    {product.product_category_name ?? "Sin categoria"}
                    {product.product_subcategory_name ? ` / ${product.product_subcategory_name}` : ""}
                    {product.unit_label ? ` · ${product.unit_label}` : ""}
                  </p>
                </div>
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
                  {product.is_available ? "Activo" : "Pausado"}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <strong className="text-lg text-ink">{formatCurrency(product.final_price)}</strong>
                {product.has_commercial_discount ? (
                  <>
                    <span className="text-sm text-zinc-400 line-through">{formatCurrency(product.price)}</span>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                      -{product.commercial_discount_percentage}% comercial
                    </span>
                  </>
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-zinc-500">
                <span className="rounded-full bg-zinc-100 px-3 py-1">
                  Stock: {product.stock_quantity ?? "Sin control"}
                </span>
                <span className="rounded-full bg-zinc-100 px-3 py-1">
                  Max por pedido: {product.max_per_order ?? "Sin limite"}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => onEdit(product)} className="rounded-full bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-700">
              Editar
            </button>
            <button type="button" onClick={() => void onDelete(product.id)} className="rounded-full bg-rose-500 px-3 py-2 text-xs font-semibold text-white">
              Eliminar
            </button>
          </div>
        </article>
      ))}
      {!products.length ? <div className="rounded-[28px] bg-white p-5 text-sm text-zinc-500 shadow-sm">Todavia no cargaste productos.</div> : null}
    </div>
  );
}
