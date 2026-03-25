import { Link } from "react-router-dom";
import { useCart } from "../../../shared/hooks";
import { useUiStore } from "../../../shared/stores";
import { formatCurrency } from "../../../shared/utils/format";

export function CartDrawer() {
  const { cart, itemCount, total } = useCart();
  const cartDrawerOpen = useUiStore((state) => state.cartDrawerOpen);
  const setCartDrawerOpen = useUiStore((state) => state.setCartDrawerOpen);

  if (!cartDrawerOpen) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setCartDrawerOpen(false)}
        className="fixed inset-0 z-40 bg-black/40"
        aria-label="Cerrar carrito"
      />
      <aside className="fixed bottom-0 right-0 top-0 z-50 w-full max-w-md border-l border-black/5 bg-white p-5 shadow-[0_20px_70px_rgba(24,19,18,0.22)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">Cart drawer</p>
            <h3 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink">
              {cart?.store_name ?? "Carrito"}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setCartDrawerOpen(false)}
            className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-zinc-700"
          >
            Cerrar
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {(cart?.items ?? []).map((item) => (
            <div key={item.id} className="rounded-[24px] bg-zinc-50 p-4 text-sm text-zinc-700">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink">{item.product_name}</p>
                  <p className="mt-1">{item.quantity} x {formatCurrency(item.unit_price)}</p>
                </div>
                <p className="font-semibold text-ink">{formatCurrency(item.unit_price * item.quantity)}</p>
              </div>
            </div>
          ))}
          {!itemCount ? <p className="text-sm text-zinc-500">No hay items en el carrito.</p> : null}
        </div>

        <div className="mt-6 rounded-[24px] bg-ink p-4 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/55">Resumen</p>
          <div className="mt-3 flex items-center justify-between">
            <span>{itemCount} productos</span>
            <strong>{formatCurrency(total)}</strong>
          </div>
          <Link
            to="/c/carrito"
            onClick={() => setCartDrawerOpen(false)}
            className="mt-4 inline-flex rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white"
          >
            Ver carrito
          </Link>
        </div>
      </aside>
    </>
  );
}
