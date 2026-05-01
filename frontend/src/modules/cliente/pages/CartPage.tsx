import { Link, useNavigate } from "react-router-dom";
import { EmptyState, LoadingCard, PageHeader } from "../../../shared/components";
import { useCart } from "../../../shared/hooks";
import { formatCurrency } from "../../../shared/utils/format";
import { CheckoutSummary } from "../components/CheckoutSummary";

const DELIVERY_MODES = [
  { key: "delivery", label: "Envio" },
  { key: "pickup", label: "Retiro" }
] as const;

export function CartPage() {
  const { cart, loading, error, updateItem, removeItem, setDeliveryMode, clear } = useCart();
  const navigate = useNavigate();
  const availableDeliveryModes = DELIVERY_MODES.filter(({ key }) =>
    key === "delivery" ? cart?.delivery_settings.delivery_enabled : cart?.delivery_settings.pickup_enabled
  );

  if (loading && !cart) return <LoadingCard />;
  if (error) return <EmptyState title="No se pudo cargar el carrito" description={error} />;
  if (!cart || !cart.items.length) {
    return (
      <EmptyState
        title="Carrito vacio"
        description="Explora comercios adheridos y arma tu pedido desde una tienda que ya este lista para vender."
        action={
          <Link to="/c" className="app-button min-h-[48px] px-4 py-2 text-sm">
            Ver comercios
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Carrito"
        title={cart.store_name ?? "Tu carrito"}
        action={
          <button
            className="rounded border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
            onClick={() => void clear()}
          >
            Vaciar carrito
          </button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <div className="app-panel p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Entrega</p>
            <div className="mt-3 flex gap-2">
              {availableDeliveryModes.length ? (
                availableDeliveryModes.map((mode) => (
                  <button
                    key={mode.key}
                    type="button"
                    onClick={() => void setDeliveryMode(mode.key)}
                    className={`kp-category-pill ${cart.delivery_mode === mode.key ? "kp-category-pill-active" : ""}`}
                  >
                    {mode.label}
                  </button>
                ))
              ) : (
                <p className="text-sm text-zinc-500">Este comercio no tiene modalidades de entrega disponibles.</p>
              )}
            </div>
          </div>

          {cart.items.map((item) => (
            <article key={item.id} className="app-panel p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold">{item.product_name}</h3>
                  <p className="mt-1 text-sm text-zinc-600">{item.note ?? "Sin nota"}</p>
                  <p className="mt-2 text-sm text-zinc-500">{formatCurrency(item.unit_price)} c/u</p>
                </div>
                <p className="text-lg font-black">{formatCurrency(item.unit_price * item.quantity)}</p>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="inline-flex items-center rounded bg-zinc-100 p-1">
                  <button
                    type="button"
                    aria-label="Reducir cantidad"
                    className="flex h-10 w-10 items-center justify-center rounded text-sm font-bold text-zinc-600 transition hover:bg-zinc-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                    onClick={() => void updateItem(item.id, { quantity: Math.max(1, item.quantity - 1) })}
                  >
                    −
                  </button>
                  <span className="min-w-10 px-3 text-center text-sm font-bold tabular-nums">{item.quantity}</span>
                  <button
                    type="button"
                    aria-label="Aumentar cantidad"
                    className="flex h-10 w-10 items-center justify-center rounded text-sm font-bold text-zinc-600 transition hover:bg-zinc-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                    onClick={() => void updateItem(item.id, { quantity: item.quantity + 1 })}
                  >
                    +
                  </button>
                </div>
                <button type="button" className="min-h-[44px] rounded bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400" onClick={() => void removeItem(item.id)}>
                  Quitar
                </button>
              </div>
            </article>
          ))}
        </div>

        <aside className="space-y-4">
          <CheckoutSummary pricing={cart.pricing} title="Resumen" discountMode="combined" />
          <button type="button" onClick={() => navigate("/c/checkout")} className="app-button w-full px-4 py-3.5 text-sm">
            Ir a pagar
          </button>
        </aside>
      </div>
    </div>
  );
}
