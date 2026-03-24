import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { checkout, fetchCategories, fetchStore, fetchStores, submitMercadoPagoWebhook } from "../api";
import { useCart } from "../../features/cart/cart-store";
import { useSession } from "../session";
import type { Category, Product, StoreDetail, StoreSummary } from "../types";
import {
  EmptyCard,
  LoadingCard,
  PageHeader,
  formatCurrency,
  normalizePath,
  orderStatusOptions,
  paymentMethodLabels,
  statusLabels,
  roleHome
} from "./common";

function StoreBadges({ store }: { store: StoreSummary }) {
  return (
    <div className="flex flex-wrap gap-2 text-xs font-semibold">
      <span className={`rounded-full px-3 py-1 ${store.is_open ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
        {store.is_open ? "Abierto" : "Cerrado"}
      </span>
      <span className="rounded-full bg-zinc-100 px-3 py-1 text-zinc-600">
        {store.accepting_orders ? "Acepta pedidos" : "No acepta pedidos"}
      </span>
      {store.primary_category ? <span className="rounded-full bg-orange-100 px-3 py-1 text-orange-700">{store.primary_category}</span> : null}
    </div>
  );
}

function StatusPill({ value }: { value: string }) {
  return <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">{statusLabels[value] ?? value}</span>;
}

function hasMercadoPago(paymentSettings: StoreSummary["payment_settings"] | StoreDetail["payment_settings"]) {
  return paymentSettings.mercadopago_enabled && paymentSettings.mercadopago_configured;
}

const mercadoPagoSimulated = (import.meta.env.VITE_MERCADOPAGO_SIMULATED ?? "true") === "true";

export function RootAliasPage() {
  const location = useLocation();
  return <Navigate to={{ pathname: "/", search: location.search, hash: location.hash }} replace />;
}

export function RegisterRedirectPage() {
  const { user, loading, isAuthenticated } = useSession();
  if (loading) return <LoadingCard label="Cargando acceso..." />;
  if (isAuthenticated && user) return <Navigate to={roleHome[user.role]} replace />;
  return <Navigate to={{ pathname: "/", hash: "#registro-cliente" }} replace />;
}

export function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [categorySlug, setCategorySlug] = useState("");
  const [search, setSearch] = useState("");
  const [deliveryMode, setDeliveryMode] = useState<"" | "delivery" | "pickup">("delivery");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCategories()
      .then((items) => {
        if (!cancelled) setCategories(items);
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchStores({
      categorySlug: categorySlug || undefined,
      search: search || undefined,
      deliveryMode: deliveryMode || undefined
    })
      .then((items) => {
        if (!cancelled) setStores(items);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudieron cargar los comercios");
          setStores([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [categorySlug, search, deliveryMode]);

  const openStores = useMemo(() => stores.filter((store) => store.is_open).length, [stores]);
  const deliveryReadyStores = useMemo(
    () => stores.filter((store) => store.delivery_settings.delivery_enabled).length,
    [stores]
  );

  return (
    <div className="space-y-6">
      <section className="ambient-grid overflow-hidden rounded-[40px] bg-[linear-gradient(135deg,#1d1614_0%,#281b18_45%,#3a221a_100%)] px-6 py-7 text-white shadow-lift md:px-8">
        <div className="absolute -right-10 top-6 h-36 w-36 rounded-full bg-brand-400/20 blur-3xl orb-float" />
        <div className="relative grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-5">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#ffd2bd]/80">Directorio comercial</p>
              <h1 className="max-w-3xl font-display text-4xl font-bold leading-[1.02] md:text-5xl">
                Descubre tiendas que muestran mejor lo que venden.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-white/72 md:text-base">
                Despensas, farmacias, kioscos y restaurantes con horarios, entrega y medios de pago visibles desde el primer vistazo.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[26px] border border-white/10 bg-white/10 p-4 backdrop-blur">
                <p className="font-display text-3xl font-bold">{stores.length}</p>
                <p className="mt-1 text-sm font-semibold text-white/86">Comercios visibles</p>
              </div>
              <div className="rounded-[26px] border border-white/10 bg-white/10 p-4 backdrop-blur">
                <p className="font-display text-3xl font-bold">{openStores}</p>
                <p className="mt-1 text-sm font-semibold text-white/86">Abiertos ahora</p>
              </div>
              <div className="rounded-[26px] border border-white/10 bg-white/10 p-4 backdrop-blur">
                <p className="font-display text-3xl font-bold">{deliveryReadyStores}</p>
                <p className="mt-1 text-sm font-semibold text-white/86">Con envio activo</p>
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-white/10 p-5 backdrop-blur-md">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#ffd2bd]/80">Lo que veras antes de comprar</p>
            <div className="mt-4 grid gap-3 text-sm text-white/74">
              <div className="rounded-[22px] bg-white/10 px-4 py-4">Rubro, estado del local y disponibilidad real.</div>
              <div className="rounded-[22px] bg-white/10 px-4 py-4">Envio o retiro con costos claros.</div>
              <div className="rounded-[22px] bg-white/10 px-4 py-4">Acceso rapido al catalogo del comercio para convertir mejor.</div>
            </div>
          </div>
        </div>
      </section>

      <PageHeader
        eyebrow="Explorar"
        title="Comercios adheridos listos para convertir pedidos"
        description="Busca por rubro, filtra por entrega y entra directo a la tienda que mejor resuelva tu compra."
      />

      <div className="grid gap-4 rounded-[28px] bg-white p-5 shadow-sm md:grid-cols-[1.3fr_0.7fr]">
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Buscar</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Despensa, farmacia, parrilla..."
            className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 outline-none transition focus:border-brand-500"
          />
        </label>
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Entrega</span>
          <select
            value={deliveryMode}
            onChange={(event) => setDeliveryMode(event.target.value as "" | "delivery" | "pickup")}
            className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 outline-none transition focus:border-brand-500"
          >
            <option value="">Todos</option>
            <option value="delivery">Envío</option>
            <option value="pickup">Retiro</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategorySlug("")}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            !categorySlug ? "bg-ink text-white" : "bg-white text-zinc-600 shadow-sm"
          }`}
        >
          Todos los rubros
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => setCategorySlug(category.slug)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              categorySlug === category.slug ? "bg-brand-500 text-white" : "bg-white text-zinc-600 shadow-sm"
            }`}
          >
            {category.name}
          </button>
        ))}
      </div>

      {loading ? <LoadingCard /> : null}
      {error ? <EmptyCard title="No se pudo cargar el listado" description={error} /> : null}

      {!loading && !error ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {stores.map((store) => (
            <Link
              key={store.id}
              to={`/stores/${store.slug}`}
              className="group overflow-hidden rounded-[28px] bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div
                className="h-40 bg-gradient-to-br from-ink to-orange-900/90"
                style={
                  store.cover_image_url
                    ? { backgroundImage: `linear-gradient(180deg, rgba(24,24,27,0.1), rgba(24,24,27,0.8)), url(${store.cover_image_url})`, backgroundSize: "cover", backgroundPosition: "center" }
                    : undefined
                }
              />
              <div className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-black tracking-tight">{store.name}</h3>
                    <p className="mt-1 text-sm text-zinc-600">{store.address}</p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                    {store.rating.toFixed(1)} ({store.rating_count})
                  </span>
                </div>
                <p className="line-clamp-2 text-sm leading-6 text-zinc-600">{store.description}</p>
                <StoreBadges store={store} />
                <div className="flex flex-wrap gap-2 text-xs font-semibold text-zinc-500">
                  <span className="rounded-full bg-zinc-100 px-3 py-1">
                    {store.delivery_settings.delivery_enabled ? `Envio ${formatCurrency(store.delivery_settings.delivery_fee)}` : "Sin envio"}
                  </span>
                  <span className="rounded-full bg-zinc-100 px-3 py-1">
                    {store.payment_settings.cash_enabled ? "Efectivo" : "Sin efectivo"}
                  </span>
                  <span className="rounded-full bg-zinc-100 px-3 py-1">
                    {hasMercadoPago(store.payment_settings) ? "Mercado Pago" : "MP no disponible"}
                  </span>
                </div>
              </div>
            </Link>
          ))}
          {!stores.length ? (
            <div className="lg:col-span-2">
              <EmptyCard
                title="No hay comercios para ese filtro"
                description="Prueba cambiar el rubro, la busqueda o el modo de entrega."
                action={
                  <button
                    className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white"
                    onClick={() => {
                      setCategorySlug("");
                      setSearch("");
                      setDeliveryMode("delivery");
                    }}
                  >
                    Limpiar filtros
                  </button>
                }
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function StoreDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useSession();
  const { addItem, storeId: cartStoreId, storeSlug: cartStoreSlug, storeName: cartStoreName } = useCart();
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
    <div className="space-y-6">
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

      {cartStoreId && cartStoreSlug !== store.slug ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Tenes un carrito iniciado en <strong>{cartStoreName}</strong>. Al agregar productos de este comercio el backend puede reemplazar el carrito anterior.
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
              <div className="h-24 w-24 shrink-0 rounded-2xl bg-zinc-100" style={product.image_url ? { backgroundImage: `url(${product.image_url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">{product.product_category_name ?? "Sin categoria"}</p>
                <h3 className="mt-1 text-lg font-bold">{product.name}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-zinc-600">{product.description}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-black text-ink">{formatCurrency(product.price)}</p>
                {product.compare_at_price ? <p className="text-xs text-zinc-400 line-through">{formatCurrency(product.compare_at_price)}</p> : null}
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${product.is_available ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>
                {product.is_available ? "Disponible" : "Agotado"}
              </span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-[90px_1fr]">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Cant.</span>
                <input
                  type="number"
                  min={1}
                  value={quantities[product.id] ?? 1}
                  onChange={(event) =>
                    setQuantities((current) => ({ ...current, [product.id]: Math.max(1, event.currentTarget.valueAsNumber || 1) }))
                  }
                  className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-3 py-2 outline-none focus:border-brand-500"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Nota</span>
                <input
                  value={notes[product.id] ?? ""}
                  onChange={(event) => setNotes((current) => ({ ...current, [product.id]: event.target.value }))}
                  placeholder="Sin cebolla, etc."
                  className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-3 py-2 outline-none focus:border-brand-500"
                />
              </label>
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
            <EmptyCard title="No hay productos en esta categoria" description="Probá otro filtro o revisá más abajo." />
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
          <h3 className="text-lg font-bold">Medios de pago y envio</h3>
          <div className="mt-4 space-y-2 text-sm text-zinc-600">
            <p>Envio: {store.delivery_settings.delivery_enabled ? `${formatCurrency(store.delivery_settings.delivery_fee)} / pedido` : "No disponible"}</p>
            <p>Retiro: {store.delivery_settings.pickup_enabled ? "Disponible" : "No disponible"}</p>
            <p>Minimo: {formatCurrency(store.delivery_settings.min_order)}</p>
            <p>Pago: {store.payment_settings.cash_enabled ? paymentMethodLabels.cash : "Sin efectivo"} | {hasMercadoPago(store.payment_settings) ? paymentMethodLabels.mercadopago : "Sin Mercado Pago"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LoginPage({ mode }: { mode: "login" | "register" }) {
  const { login, register, loading: sessionLoading } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const profile =
        mode === "login"
          ? await login(email, password)
          : await register(fullName, email, password);
      navigate(from ?? roleHome[profile.role], { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar el acceso");
    } finally {
      setLoading(false);
    }
  }

  const title = mode === "login" ? "Ingresar a TuPedido" : "Crear cuenta";
  const submitLabel = mode === "login" ? "Ingresar" : "Crear cuenta";

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <PageHeader
        eyebrow="Acceso"
        title={title}
        description="La sesión se guarda en el navegador y se restaura con el perfil real del backend."
        action={
          <Link className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15" to={mode === "login" ? "/register" : "/login"}>
            {mode === "login" ? "Crear cuenta" : "Ya tengo cuenta"}
          </Link>
        }
      />

      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4 rounded-[32px] bg-white p-6 shadow-sm">
        {mode === "register" ? (
          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Nombre completo</span>
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
              className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 outline-none focus:border-brand-500"
            />
          </label>
        ) : null}
        <label className="block space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 outline-none focus:border-brand-500"
          />
        </label>
        <label className="block space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={6}
            className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 outline-none focus:border-brand-500"
          />
        </label>
        {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
        <button
          type="submit"
          disabled={loading || sessionLoading}
          className="w-full rounded-full bg-brand-500 px-4 py-3 text-sm font-semibold text-white shadow-float transition disabled:cursor-not-allowed disabled:bg-zinc-300"
        >
          {loading || sessionLoading ? "Procesando..." : submitLabel}
        </button>
      </form>

      <div className="rounded-[32px] bg-ink p-6 text-white shadow-float">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/50">Roles</p>
        <div className="mt-4 space-y-4 text-sm text-white/75">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <p className="font-bold text-white">Cliente</p>
            <p className="mt-1">Explora, agrega al carrito, paga y sigue pedidos.</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <p className="font-bold text-white">Comercio</p>
            <p className="mt-1">Administra local, horarios, productos, categorias y pedidos.</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <p className="font-bold text-white">Admin</p>
            <p className="mt-1">Aprueba comercios, revisa aplicaciones y controla la plataforma.</p>
          </div>
        </div>
        <p className="mt-6 text-sm text-white/55">
          Sesion persistida con restauracion de perfil desde <code>/auth/me</code>.
        </p>
      </div>
    </div>
  );
}

export function MercadoPagoSimulatedPage() {
  if (!mercadoPagoSimulated) {
    return <EmptyCard title="Simulador deshabilitado" description="Este entorno usa la integracion real de Mercado Pago." />;
  }

  const [searchParams] = useSearchParams();
  const initialReference = searchParams.get("reference") ?? searchParams.get("order_id") ?? "";
  const [reference, setReference] = useState(initialReference);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ order_id: number; status: string; payment_status: string } | null>(null);

  useEffect(() => {
    setReference(initialReference);
  }, [initialReference]);

  async function resolve(status: "approved" | "rejected" | "cancelled") {
    const cleanReference = reference.trim();
    if (!cleanReference) {
      setError("Ingresá una referencia valida");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const order = await submitMercadoPagoWebhook({ reference: cleanReference, status });
      setResult({ order_id: order.id, status: order.status, payment_status: order.payment_status });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el webhook simulado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pagos"
        title="Simulador de Mercado Pago"
        description="Usa esta pantalla para disparar el webhook de pago y probar aprobacion, rechazo o cancelacion."
      />
      <div className="rounded-[32px] bg-white p-6 shadow-sm">
        <label className="block space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Referencia</span>
          <input
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="order-123 o referencia de pago"
            className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 outline-none focus:border-brand-500"
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-3">
          <button disabled={loading} onClick={() => void resolve("approved")} className="rounded-full bg-emerald-500 px-4 py-3 text-sm font-semibold text-white disabled:bg-zinc-300">
            Aprobar
          </button>
          <button disabled={loading} onClick={() => void resolve("rejected")} className="rounded-full bg-rose-500 px-4 py-3 text-sm font-semibold text-white disabled:bg-zinc-300">
            Rechazar
          </button>
          <button disabled={loading} onClick={() => void resolve("cancelled")} className="rounded-full bg-zinc-800 px-4 py-3 text-sm font-semibold text-white disabled:bg-zinc-300">
            Cancelar
          </button>
        </div>
        {error ? <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
        {result ? (
          <div className="mt-4 rounded-[24px] bg-zinc-50 p-4 text-sm text-zinc-700">
            <p className="font-semibold text-zinc-900">Webhook aplicado</p>
            <p className="mt-1">Pedido #{result.order_id}</p>
            <p className="mt-1">Estado: {result.status}</p>
            <p className="mt-1">Pago: {result.payment_status}</p>
            <Link className="mt-3 inline-flex rounded-full bg-brand-500 px-4 py-2 font-semibold text-white" to={`/orders/${result.order_id}`}>
              Ver pedido
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
