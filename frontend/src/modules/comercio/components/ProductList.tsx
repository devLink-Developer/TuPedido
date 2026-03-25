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
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="font-bold">{product.name}</h4>
              <p className="text-sm text-zinc-600">{formatCurrency(product.price)} · {product.product_category_name ?? "Sin categoría"}</p>
            </div>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">{product.is_available ? "Activo" : "Pausado"}</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => onEdit(product)} className="rounded-full bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-700">Editar</button>
            <button type="button" onClick={() => void onDelete(product.id)} className="rounded-full bg-rose-500 px-3 py-2 text-xs font-semibold text-white">Eliminar</button>
          </div>
        </article>
      ))}
    </div>
  );
}
