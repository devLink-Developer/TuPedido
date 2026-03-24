import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { fetchStore } from "../api";
import { useCart } from "../../features/cart/cart-store";
import { useSession } from "../session";
import type { Product, StoreDetail } from "../types";
import { EmptyCard, LoadingCard, formatCurrency, paymentMethodLabels } from "./common";

function hasMercadoPago(paymentSettings: StoreDetail["payment_settings"]) {
  return paymentSettings.mercadopago_enabled && paymentSettings.mercadopago_configured;
}

export function StoreDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useSession();
  const {
    addItem,
    itemCount,
    total,
    storeId: cartStoreId,
    storeSlug: cartStoreSlug,
    storeName: cartStoreName
  } = useCart();
  const [store, setStore] = useState<StoreDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | "all">("all");
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [savingProductId, setSavingProductId] = useState<number | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchStore(slug)
      .then((data) => {
        if (!cancelled) {
          setStore(data);
          setSelectedCategory("all");
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "No se pudo cargar el comercio");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const filteredProducts = useMemo(() => {
    if (!store) return [];
    return store.products.filter((product) => selectedCategory === "all" || product.product_category_id === selectedCategory);
  }, [selectedCategory, store]);

  function etaLabel() {
    if (!store) return "";
    if (store.min_delivery_minutes && store.max_delivery_minutes) {
      if (store.min_delivery_minutes === store.max_delivery_minutes) {
        return `${store.min_delivery_minutes} min`;
      }
      return `${store.min_delivery_minutes}-${store.max_delivery_minutes} min`;
    }
    if (store.max_delivery_minutes) return `Hasta ${store.max_delivery_minutes} min`;
    if (store.min_delivery_minutes) return `${store.min_delivery_minutes} min`;
    return "Segun demanda";
  }

  function setProductQuantity(productId: number, nextValue: number) {
    setQuantities((current) => ({
      ...current,
      [productId]: Math.max(1, nextValue)
    }));
  }

  async function handleAdd(product: Product) {
    if (!store) return;
    if (!isAuthenticated) {
      navigate("/login", { state: { from: `/stores/${store.slug}` } });
      return;
    }

    setSavingProductId(product.id);
    setError(null);

    try {
      await addItem({
        storeId: store.id,
        productId: product.id,
        quantity: quantities[product.id] ?? 1,
        note: notes[product.id]?.trim() || null
      });
      setNotes((current) => ({ ...current, [product.id]: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agregar al carrito");
    } finally {
      setSavingProductId(null);
    }
  }

  if (loading) return <LoadingCard />;
  if (error) return <EmptyCard title="Error al cargar el comercio" description={error} />;
  if (!store) return <EmptyCard title="Comercio no encontrado" description="Ese comercio no existe o fue dado de baja." />;

  return (
    <div className="space-y-5 pb-[calc(var(--bottom-nav-height)+var(--mobile-cart-cta-height)+2.5rem+var(--safe-bottom))] md:space-y-6 md:pb-8">
      <div className="overflow-hidden rounded-[32px] bg-white shadow-sm">
        <div
          className="relative h-44 bg-gradient-to-br from-ink via-ink to-orange-800 md:h-56"
          style={
            store.cover_image_url
              ? {
                  backgroundImage: `linear-gradient(180deg, rgba(24,24,27,0.1), rgba(24,24,27,0.78)), url(${store.cover_image_url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center"
                }
              : undefined
          }
        >
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(24,24,27,0.12),rgba(24,24,27,0.82))]" />
          <div className="absolute inset-x-0 bottom-0 p-5 text-white">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/60">
                  {store.primary_category ?? store.categories[0] ?? "Comercio"}
                </p>
                <h1 className="mt-2 truncate font-display text-[2rem] font-bold tracking-tight">{store.name}</h1>
              </div>
              <span className="shrink-0 rounded-full bg-white/12 px-3 py-1 text-xs font-bold text-white backdrop-blur">
                {store.rating.toFixed(1)}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
              <span
                className={`rounded-full px-3 py-1 ${
                  store.is_open ? "bg-emerald-400/18 text-emerald-100" : "bg-rose-400/18 text-rose-100"
                }`}
              >
                {store.is_open ? "Abierto" : "Cerrado"}
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-white/86 backdrop-blur">{etaLabel()}</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-white/86 backdrop-blur">
                {store.delivery_settings.delivery_enabled
                  ? `Envio ${formatCurrency(store.delivery_settings.delivery_fee)}`
                  : "Solo retiro"}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-5 md:p-6">
          <div className="space-y-3">
            <p className="text-sm leading-7 text-zinc-600">{store.description}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[22px] bg-zinc-50 px-4 py-4 text-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">Entrega</p>
                <p className="mt-2 font-semibold text-zinc-900">{etaLabel()}</p>
              </div>
              <div className="rounded-[22px] bg-zinc-50 px-4 py-4 text-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">Pago</p>
                <p className="mt-2 font-semibold text-zinc-900">
                  {store.payment_settings.cash_enabled ? "Efectivo" : "Sin efectivo"}
                  {hasMercadoPago(store.payment_settings) ? " y Mercado Pago" : ""}
                </p>
              </div>
              <div className="rounded-[22px] bg-zinc-50 px-4 py-4 text-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">Pedido minimo</p>
                <p className="mt-2 font-semibold text-zinc-900">{formatCurrency(store.delivery_settings.min_order)}</p>
              </div>
            </div>
            <div className="rounded-[24px] bg-zinc-50 p-4 text-sm text-zinc-600">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-zinc-900">{store.address}</p>
                  <p className="mt-2">{store.phone}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    store.is_open ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                  }`}
                >
                  {store.is_open ? "Tomando pedidos" : "Fuera de horario"}
                </span>
              </div>
              <p className="mt-3">{store.opening_note ?? (store.is_open ? "Abierto ahora" : "Cerrado ahora")}</p>
            </div>
          </div>
        </div>
      </div>

      {cartStoreId && cartStoreSlug !== store.slug ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p>
            Tienes un carrito iniciado en <strong>{cartStoreName}</strong>. Antes de cambiar de comercio conviene revisar ese pedido.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to="/cart" className="rounded-full bg-amber-900 px-4 py-2 text-xs font-semibold text-white">
              Ver carrito actual
            </Link>
          </div>
        </div>
      ) : null}

      <div className="sticky top-[calc(var(--mobile-header-height)+var(--safe-top)+0.5rem)] z-20 -mx-4 overflow-x-auto bg-[linear-gradient(180deg,rgba(248,239,226,0.98),rgba(248,239,226,0.82))] px-4 py-2 hide-scrollbar md:static md:mx-0 md:bg-transparent md:px-0 md:py-0">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className={`whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold transition ${
              selectedCategory === "all" ? "bg-ink text-white shadow-float" : "bg-white text-zinc-600 shadow-sm"
            }`}
          >
            Todo
          </button>
          {store.product_categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setSelectedCategory(category.id)}
              className={`whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                selectedCategory === category.id ? "bg-brand-500 text-white shadow-float" : "bg-white text-zinc-600 shadow-sm"
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {filteredProducts.map((product) => (
          <article key={product.id} className="rounded-[28px] bg-white p-4 shadow-sm md:p-5">
            <div className="flex gap-4">
              <div
                className="h-20 w-20 shrink-0 rounded-[22px] bg-zinc-100 md:h-24 md:w-24"
                style={
                  product.image_url
                    ? { backgroundImage: `url(${product.image_url})`, backgroundSize: "cover", backgroundPosition: "center" }
                    : undefined
                }
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                      {product.product_category_name ?? "Sin categoria"}
                    </p>
                    <h3 className="mt-1 text-lg font-bold">{product.name}</h3>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ${
                      product.is_available ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"
                    }`}
                  >
                    {product.is_available ? "Disponible" : "Agotado"}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-600">{product.description}</p>
              </div>
            </div>

            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-lg font-black text-ink">{formatCurrency(product.price)}</p>
                {product.compare_at_price ? <p className="text-xs text-zinc-400 line-through">{formatCurrency(product.compare_at_price)}</p> : null}
              </div>
              <div className="flex items-center gap-2 rounded-full bg-zinc-100 p-1">
                <button
                  type="button"
                  onClick={() => setProductQuantity(product.id, (quantities[product.id] ?? 1) - 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg font-bold text-zinc-700 shadow-sm"
                >
                  -
                </button>
                <span className="w-8 text-center text-sm font-bold text-zinc-800">{quantities[product.id] ?? 1}</span>
                <button
                  type="button"
                  onClick={() => setProductQuantity(product.id, (quantities[product.id] ?? 1) + 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg font-bold text-zinc-700 shadow-sm"
                >
                  +
                </button>
              </div>
            </div>

            <details className="mt-3 rounded-[22px] bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
              <summary className="cursor-pointer list-none text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                Agregar nota
              </summary>
              <input
                value={notes[product.id] ?? ""}
                onChange={(event) => setNotes((current) => ({ ...current, [product.id]: event.target.value }))}
                placeholder="Sin cebolla, bien cocido, etc."
                className="mt-3 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 outline-none focus:border-brand-500"
              />
            </details>

            <button
              type="button"
              disabled={!product.is_available || savingProductId === product.id}
              onClick={() => void handleAdd(product)}
              className="mt-4 w-full rounded-full bg-brand-500 px-4 py-3 text-sm font-semibold text-white shadow-float transition disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              {savingProductId === product.id
                ? "Agregando..."
                : product.is_available
                  ? `Agregar ${formatCurrency((quantities[product.id] ?? 1) * product.price)}`
                  : "Agotado"}
            </button>
          </article>
        ))}

        {!filteredProducts.length ? (
          <div className="md:col-span-2">
            <EmptyCard title="No hay productos en esta categoria" description="Prueba otro filtro o revisa mas abajo." />
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[28px] bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold">Horarios</h3>
          <div className="mt-4 space-y-2 text-sm text-zinc-600">
            {store.hours.map((hour) => (
              <div key={hour.day_of_week} className="flex items-center justify-between rounded-2xl bg-zinc-50 px-4 py-3">
                <span className="font-semibold">{["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"][hour.day_of_week]}</span>
                <span>{hour.is_closed ? "Cerrado" : `${hour.opens_at?.slice(0, 5)} - ${hour.closes_at?.slice(0, 5)}`}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold">Medios de pago y entrega</h3>
          <div className="mt-4 space-y-2 text-sm text-zinc-600">
            <p>Envio: {store.delivery_settings.delivery_enabled ? `${formatCurrency(store.delivery_settings.delivery_fee)} / pedido` : "No disponible"}</p>
            <p>Retiro: {store.delivery_settings.pickup_enabled ? "Disponible" : "No disponible"}</p>
            <p>Minimo: {formatCurrency(store.delivery_settings.min_order)}</p>
            <p>
              Pago: {store.payment_settings.cash_enabled ? paymentMethodLabels.cash : "Sin efectivo"} |{" "}
              {hasMercadoPago(store.payment_settings) ? paymentMethodLabels.mercadopago : "Sin Mercado Pago"}
            </p>
          </div>
        </div>
      </div>

      {cartStoreSlug === store.slug && itemCount > 0 ? (
        <div className="fixed bottom-[calc(var(--bottom-nav-height)+1rem+var(--safe-bottom))] left-4 right-4 z-30 md:hidden">
          <Link
            to="/cart"
            className="mx-auto flex max-w-md items-center justify-between gap-3 rounded-[26px] bg-ink px-4 py-4 text-white shadow-[0_22px_44px_rgba(24,19,18,0.28)]"
          >
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/55">Carrito activo</p>
              <p className="mt-1 truncate text-sm font-semibold">{itemCount} productos en {store.name}</p>
            </div>
            <div className="text-right">
              <p className="text-base font-black">{formatCurrency(total)}</p>
              <p className="text-xs font-semibold text-brand-200">Ver carrito</p>
            </div>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
