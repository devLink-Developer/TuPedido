import { Link } from "react-router-dom";
import { ShoppingBag, X } from "lucide-react";
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
        className="fixed inset-0 z-40 bg-[rgba(92,52,24,0.24)] backdrop-blur-[2px]"
        aria-label="Cerrar carrito"
      />
      <aside className="kp-drawer fixed bottom-0 right-0 top-0 z-50 w-full max-w-md p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="kp-install-icon flex h-11 w-11 shrink-0 items-center justify-center border border-[rgba(255,106,26,0.24)] bg-[var(--kp-accent-soft)] text-[var(--kp-accent)]">
              <ShoppingBag className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--kp-accent)]">Carrito</p>
              <h3 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink">
                {cart?.store_name ?? "Carrito"}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCartDrawerOpen(false)}
            className="kp-soft-action h-11 min-h-0 w-11 p-0"
            aria-label="Cerrar carrito"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {(cart?.items ?? []).map((item) => (
            <div key={item.id} className="border border-[var(--kp-stroke)] bg-white/84 p-4 text-sm text-zinc-700">
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

        <div className="mt-6 border border-[rgba(255,106,26,0.22)] bg-[var(--kp-accent-soft)] p-4 text-[var(--kp-ink-strong)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--kp-accent)]">Resumen</p>
          <div className="mt-3 flex items-center justify-between">
            <span>{itemCount} productos</span>
            <strong>{formatCurrency(total)}</strong>
          </div>
          <Link
            to="/c/carrito"
            onClick={() => setCartDrawerOpen(false)}
            className="app-button mt-4 min-h-[48px] px-4 py-2 text-sm"
          >
            Ver carrito
          </Link>
        </div>
      </aside>
    </>
  );
}
