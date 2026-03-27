import { Link, useNavigate } from "react-router-dom";
import { EmptyState, LoadingCard, PageHeader } from "../../../shared/components";
import { useCart } from "../../../shared/hooks";
import { formatCurrency } from "../../../shared/utils/format";
import { CheckoutSummary } from "../components/CheckoutSummary";

export function CartPage() {
  const { cart, loading, error, updateItem, removeItem, setDeliveryMode, clear } = useCart();
  const navigate = useNavigate();

  if (loading && !cart) return <LoadingCard />;
  if (error) return <EmptyState title="No se pudo cargar el carrito" description={error} />;
  if (!cart || !cart.items.length) {
    return (
      <EmptyState
        title="Carrito vacio"
        description="Explora comercios adheridos y arma tu pedido desde una tienda que ya este lista para vender."
        action={
          <Link to="/c" className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white">
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
          <button className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white" onClick={() => void clear()}>
            Vaciar carrito
          </button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <div className="rounded-[28px] bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Entrega</p>
            <div className="mt-3 flex gap-2">
              {(["delivery", "pickup"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => void setDeliveryMode(mode)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    cart.delivery_mode === mode ? "bg-brand-500 text-white" : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  {mode === "delivery" ? "Envio" : "Retiro"}
                </button>
              ))}
            </div>
          </div>

          {cart.items.map((item) => (
            <article key={item.id} className="rounded-[28px] bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold">{item.product_name}</h3>
                  <p className="mt-1 text-sm text-zinc-600">{item.note ?? "Sin nota"}</p>
                  <p className="mt-2 text-sm text-zinc-500">{formatCurrency(item.unit_price)} c/u</p>
                </div>
                <p className="text-lg font-black">{formatCurrency(item.unit_price * item.quantity)}</p>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="inline-flex items-center rounded-full bg-zinc-100 p-1">
                  <button
                    type="button"
                    className="rounded-full px-3 py-2 text-sm font-semibold text-zinc-600"
                    onClick={() => void updateItem(item.id, { quantity: Math.max(1, item.quantity - 1) })}
                  >
                    -
                  </button>
                  <span className="min-w-10 px-3 text-center text-sm font-bold">{item.quantity}</span>
                  <button
                    type="button"
                    className="rounded-full px-3 py-2 text-sm font-semibold text-zinc-600"
                    onClick={() => void updateItem(item.id, { quantity: item.quantity + 1 })}
                  >
                    +
                  </button>
                </div>
                <button type="button" className="rounded-full bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700" onClick={() => void removeItem(item.id)}>
                  Quitar
                </button>
              </div>
            </article>
          ))}
        </div>

        <aside className="space-y-4">
          <CheckoutSummary pricing={cart.pricing} title="Resumen" discountMode="combined" />
          <button type="button" onClick={() => navigate("/c/checkout")} className="w-full rounded-full bg-brand-500 px-4 py-3 text-sm font-semibold text-white">
            Ir a pagar
          </button>
        </aside>
      </div>
    </div>
  );
}
