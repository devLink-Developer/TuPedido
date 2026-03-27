import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { EmptyState, LoadingCard, PageHeader } from "../../../shared/components";
import { useAuthSession, useCart } from "../../../shared/hooks";
import { fetchStoreById } from "../../../shared/services/api";
import { useUiStore } from "../../../shared/stores";
import type { Product, StoreDetail } from "../../../shared/types";
import { formatCurrency } from "../../../shared/utils/format";

function hasMercadoPago(paymentSettings: StoreDetail["payment_settings"]) {
  return paymentSettings.mercadopago_enabled && paymentSettings.mercadopago_configured;
}

function getMaxAllowed(product: Product) {
  return product.max_per_order ?? product.stock_quantity;
}

export function StoreDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthSession();
  const { addItem, itemCount, total, storeId: cartStoreId, storeName: cartStoreName } = useCart();
  const enqueueToast = useUiStore((state) => state.enqueueToast);
  const [store, setStore] = useState<StoreDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | "all">("all");
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [noteInputsOpen, setNoteInputsOpen] = useState<Record<number, boolean>>({});
  const [savingProductId, setSavingProductId] = useState<number | null>(null);
  const storeId = id ? Number(id) : null;

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchStoreById(storeId)
      .then((data) => {
        if (!cancelled) {
          setStore(data);
          setSelectedCategory("all");
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "No se pudo cargar el comercio");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const filteredProducts = useMemo(() => {
    if (!store) return [];
    return store.products.filter((product) => selectedCategory === "all" || product.product_category_id === selectedCategory);
  }, [selectedCategory, store]);

  function normalizeQuantity(product: Product, rawQuantity: string | undefined) {
    const parsedQuantity = Number(rawQuantity);
    const maxAllowed = getMaxAllowed(product);

    if (!rawQuantity || !Number.isInteger(parsedQuantity) || parsedQuantity < 1) {
      return 1;
    }

    if (maxAllowed !== null && parsedQuantity > maxAllowed) {
      return maxAllowed;
    }

    return parsedQuantity;
  }

  function setProductQuantity(product: Product, nextValue: string) {
    if (nextValue === "") {
      setQuantities((current) => ({ ...current, [product.id]: "" }));
      return;
    }

    if (!/^\d+$/.test(nextValue)) {
      return;
    }

    const parsedQuantity = Number(nextValue);
    const maxAllowed = getMaxAllowed(product);

    if (maxAllowed !== null && parsedQuantity > maxAllowed) {
      enqueueToast(`Solo puedes pedir hasta ${maxAllowed} ${maxAllowed === 1 ? "unidad" : "unidades"}.`);
      setQuantities((current) => ({ ...current, [product.id]: String(maxAllowed) }));
      return;
    }

    setQuantities((current) => ({ ...current, [product.id]: nextValue }));
  }

  function handleQuantityBlur(product: Product) {
    const normalizedQuantity = normalizeQuantity(product, quantities[product.id]);
    setQuantities((current) => ({ ...current, [product.id]: String(normalizedQuantity) }));
  }

  async function handleAdd(product: Product) {
    if (!store) return;
    if (!isAuthenticated) {
      navigate(`/login?redirectTo=${encodeURIComponent(`/c/tienda/${store.id}`)}`);
      return;
    }

    const quantity = normalizeQuantity(product, quantities[product.id]);
    setQuantities((current) => ({ ...current, [product.id]: String(quantity) }));
    setSavingProductId(product.id);
    setError(null);
    try {
      await addItem({
        storeId: store.id,
        productId: product.id,
        quantity,
        note: notes[product.id]?.trim() || null
      });
      setNotes((current) => ({ ...current, [product.id]: "" }));
      setNoteInputsOpen((current) => ({ ...current, [product.id]: false }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo agregar al carrito");
    } finally {
      setSavingProductId(null);
    }
  }

  if (loading) return <LoadingCard />;
  if (error) return <EmptyState title="Error al cargar el comercio" description={error} />;
  if (!store) return <EmptyState title="Comercio no encontrado" description="Ese comercio no existe o fue dado de baja." />;

  return (
    <div className="space-y-6 pb-24">
      <div className="overflow-hidden rounded-[32px] bg-white shadow-sm">
        <div
          className="h-56 bg-gradient-to-br from-ink via-ink to-orange-800"
          style={
            store.cover_image_url
              ? {
                  backgroundImage: `linear-gradient(180deg, rgba(24,24,27,0.1), rgba(24,24,27,0.78)), url(${store.cover_image_url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center"
                }
              : undefined
          }
        />
        <div className="space-y-4 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <PageHeader eyebrow="Comercio" title={store.name} description={store.description} />
            </div>
            <div className="rounded-[24px] bg-zinc-50 p-4 text-sm text-zinc-600">
              <p className="font-semibold text-zinc-800">{store.address}</p>
              <p className="mt-2">{store.phone}</p>
              <p className="mt-2">{store.opening_note ?? (store.is_open ? "Abierto ahora" : "Cerrado ahora")}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className={`rounded-full px-3 py-1 ${store.is_open ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
              {store.is_open ? "Abierto" : "Cerrado"}
            </span>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-zinc-600">
              {store.delivery_settings.delivery_enabled ? "Envio habilitado" : "Sin envio"}
            </span>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-zinc-600">
              {store.delivery_settings.pickup_enabled ? "Retiro habilitado" : "Sin retiro"}
            </span>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-zinc-600">
              {store.payment_settings.cash_enabled ? "Efectivo" : "Sin efectivo"}
            </span>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-zinc-600">
              {hasMercadoPago(store.payment_settings) ? "Mercado Pago" : "MP no disponible"}
            </span>
          </div>
        </div>
      </div>

      {cartStoreId && cartStoreId !== store.id ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Tienes un carrito iniciado en <strong>{cartStoreName}</strong>. Si agregas productos de este comercio, tu carrito actual puede actualizarse.
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSelectedCategory("all")}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            selectedCategory === "all" ? "bg-ink text-white" : "bg-white text-zinc-600 shadow-sm"
          }`}
        >
          Todo
        </button>
        {store.product_categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => setSelectedCategory(category.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              selectedCategory === category.id ? "bg-brand-500 text-white" : "bg-white text-zinc-600 shadow-sm"
            }`}
          >
            {category.name}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {filteredProducts.map((product) => (
          <article key={product.id} className="rounded-[28px] bg-white p-5 shadow-sm">
            <div className="flex gap-4">
              <div
                className="h-24 w-24 shrink-0 rounded-2xl bg-zinc-100"
                style={product.image_url ? { backgroundImage: `url(${product.image_url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">{product.product_category_name ?? "Sin categoria"}</p>
                <h3 className="mt-1 text-lg font-bold">{product.name}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-zinc-600">{product.description}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-black text-ink">{formatCurrency(product.final_price)}</p>
                {product.has_commercial_discount ? (
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <p className="text-xs text-zinc-400 line-through">{formatCurrency(product.price)}</p>
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                      -{product.commercial_discount_percentage}% comercial
                    </span>
                  </div>
                ) : product.compare_at_price ? (
                  <p className="text-xs text-zinc-400 line-through">{formatCurrency(product.compare_at_price)}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-zinc-500">
                  {product.brand ? <span className="rounded-full bg-zinc-100 px-2 py-1">{product.brand}</span> : null}
                  {product.unit_label ? <span className="rounded-full bg-zinc-100 px-2 py-1">{product.unit_label}</span> : null}
                  {product.stock_quantity !== null ? (
                    <span className="rounded-full bg-zinc-100 px-2 py-1">Stock {product.stock_quantity}</span>
                  ) : null}
                </div>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${product.is_available ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>
                {product.is_available ? "Disponible" : "Agotado"}
              </span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-[90px_1fr] md:items-end">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Cant.</span>
                <input
                  type="number"
                  min={1}
                  max={getMaxAllowed(product) ?? undefined}
                  inputMode="numeric"
                  value={quantities[product.id] ?? "1"}
                  onChange={(event) => setProductQuantity(product, event.currentTarget.value)}
                  onBlur={() => handleQuantityBlur(product)}
                  className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-3 py-2 outline-none focus:border-brand-500"
                />
              </label>
              {noteInputsOpen[product.id] ? (
                <input
                  value={notes[product.id] ?? ""}
                  onChange={(event) => setNotes((current) => ({ ...current, [product.id]: event.target.value }))}
                  placeholder="Sin cebolla, etc."
                  className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-3 py-2 outline-none focus:border-brand-500"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setNoteInputsOpen((current) => ({ ...current, [product.id]: true }))}
                  className="justify-self-start pb-2 text-sm font-semibold text-zinc-500 transition hover:text-ink"
                >
                  Agregar nota
                </button>
              )}
            </div>
            <button
              type="button"
              disabled={!product.is_available || savingProductId === product.id}
              onClick={() => void handleAdd(product)}
              className="mt-4 w-full rounded-full bg-brand-500 px-4 py-3 text-sm font-semibold text-white shadow-float transition disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              {savingProductId === product.id ? "Agregando..." : "Agregar al carrito"}
            </button>
          </article>
        ))}
        {!filteredProducts.length ? (
          <div className="md:col-span-2">
            <EmptyState title="No hay productos en esta categoria" description="Prueba otro filtro o revisa mas abajo." />
          </div>
        ) : null}
      </div>

    </div>
  );
}
