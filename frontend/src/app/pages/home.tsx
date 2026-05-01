import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { fetchCategories, fetchStores } from "../api";
import { useSession } from "../session";
import { useCart } from "../../features/cart/cart-store";
import type { Category, StoreSummary } from "../types";
import { EmptyCard, LoadingCard, formatCurrency, roleHome } from "./common";

function hasMercadoPago(store: StoreSummary) {
  return store.payment_settings.mercadopago_enabled && store.payment_settings.mercadopago_configured;
}

function etaLabel(store: StoreSummary) {
  if (store.min_delivery_minutes && store.max_delivery_minutes) {
    if (store.min_delivery_minutes === store.max_delivery_minutes) {
      return `${store.min_delivery_minutes} min`;
    }
    return `${store.min_delivery_minutes}-${store.max_delivery_minutes} min`;
  }
  if (store.max_delivery_minutes) {
    return `Hasta ${store.max_delivery_minutes} min`;
  }
  if (store.min_delivery_minutes) {
    return `${store.min_delivery_minutes} min`;
  }
  return "Entrega del dia";
}

function paymentLabel(store: StoreSummary) {
  if (hasMercadoPago(store) && store.payment_settings.cash_enabled) return "Efectivo y MP";
  if (hasMercadoPago(store)) return "Mercado Pago";
  if (store.payment_settings.cash_enabled) return "Efectivo";
  return "Consultar pago";
}

function deliveryPriceLabel(store: StoreSummary) {
  return store.delivery_settings.delivery_enabled ? formatCurrency(store.delivery_settings.delivery_fee) : "Solo retiro";
}

function SectionHeading({
  eyebrow,
  title,
  description,
  action
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-400">{eyebrow}</p>
        <h2 className="mt-1 font-display text-[1.65rem] font-bold tracking-tight text-ink md:text-[1.95rem]">
          {title}
        </h2>
        {description ? <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function CategoryShortcut({
  category,
  active,
  onClick
}: {
  category: Category;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex min-w-[128px] shrink-0 flex-col rounded border px-4 py-4 text-left transition ${
        active
          ? "border-brand-500 bg-[linear-gradient(135deg,#fff1e5,#ffe2cc)] shadow-float"
          : "border-black/8 bg-white hover:-translate-y-0.5 hover:shadow-sm"
      }`}
    >
      <span
        className={`flex h-11 w-11 items-center justify-center rounded text-sm font-black uppercase ${
          active ? "bg-brand-500 text-white" : "bg-zinc-100 text-zinc-700"
        }`}
      >
        {category.name.slice(0, 2)}
      </span>
      <span className="mt-3 line-clamp-1 text-sm font-semibold text-ink">{category.name}</span>
      <span className="mt-1 text-xs text-zinc-500">{category.description ?? "Ver tiendas"}</span>
    </button>
  );
}

function QuickCollectionCard({
  label,
  title,
  value,
  subtitle,
  active,
  onClick
}: {
  label: string;
  title: string;
  value: string;
  subtitle: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span
        className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${
          active ? "text-white/72" : "text-zinc-400"
        }`}
      >
        {label}
      </span>
      <span className="mt-3 font-display text-3xl font-bold tracking-tight">{value}</span>
      <span className={`mt-1 text-sm font-semibold ${active ? "text-white" : "text-ink"}`}>{title}</span>
      <span className={`mt-2 text-xs leading-5 ${active ? "text-white/74" : "text-zinc-500"}`}>{subtitle}</span>
    </>
  );
  const className = `flex min-w-[220px] shrink-0 flex-col rounded border px-4 py-4 text-left transition ${
    active
      ? "border-brand-500 bg-[linear-gradient(145deg,#fb923c,#c2410c)] text-white shadow-float"
      : "border-black/8 bg-white hover:-translate-y-0.5 hover:shadow-sm"
  }`;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

function MiniStoreCard({ store }: { store: StoreSummary }) {
  return (
    <Link
      to={`/stores/${store.slug}`}
      className="group flex min-w-[260px] shrink-0 gap-3 rounded border border-black/8 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div
        className="h-24 w-24 shrink-0 rounded bg-[linear-gradient(135deg,#1f1715,#8a3c12)]"
        style={
          store.cover_image_url
            ? {
                backgroundImage: `linear-gradient(180deg, rgba(24,24,27,0.06), rgba(24,24,27,0.55)), url(${store.cover_image_url})`,
                backgroundSize: "cover",
                backgroundPosition: "center"
              }
            : undefined
        }
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
              {store.primary_category ?? store.categories[0] ?? "Comercio"}
            </p>
            <h3 className="mt-1 truncate text-base font-black tracking-tight text-ink">{store.name}</h3>
          </div>
          <span className="rounded bg-zinc-100 px-2.5 py-1 text-[11px] font-bold text-zinc-700">
            {store.rating.toFixed(1)}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold">
          <span className={`rounded px-2.5 py-1 ${store.is_open ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
            {store.is_open ? "Abierto" : "Cerrado"}
          </span>
          <span className="rounded bg-zinc-100 px-2.5 py-1 text-zinc-600">{etaLabel(store)}</span>
        </div>
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-500">{store.description}</p>
      </div>
    </Link>
  );
}

function StoreCard({ store }: { store: StoreSummary }) {
  return (
    <Link
      to={`/stores/${store.slug}`}
      className="group overflow-hidden rounded border border-white/80 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div
        className="relative h-40 overflow-hidden rounded bg-[linear-gradient(135deg,#1f1715,#8a3c12)]"
        style={
          store.cover_image_url
            ? {
                backgroundImage: `linear-gradient(180deg, rgba(24,24,27,0.1), rgba(24,24,27,0.7)), url(${store.cover_image_url})`,
                backgroundSize: "cover",
                backgroundPosition: "center"
              }
            : undefined
        }
      >
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3">
          <div className="flex flex-wrap gap-2">
            <span
              className={`rounded px-3 py-1 text-[11px] font-bold ${
                store.is_open ? "bg-white text-emerald-700" : "bg-white/92 text-rose-700"
              }`}
            >
              {store.is_open ? "Abierto ahora" : "Cerrado"}
            </span>
            <span className="rounded bg-black/50 px-3 py-1 text-[11px] font-semibold text-white">
              {store.delivery_settings.delivery_enabled ? "Delivery" : "Retiro"}
            </span>
          </div>
          <span className="rounded bg-white/94 px-3 py-1 text-[11px] font-bold text-ink">
            {store.rating.toFixed(1)}
          </span>
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(17,17,17,0.78))] p-4 text-white">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70">
            {store.primary_category ?? store.categories[0] ?? "Comercio"}
          </p>
          <h3 className="mt-1 text-xl font-black tracking-tight">{store.name}</h3>
          <p className="mt-1 line-clamp-1 text-xs text-white/74">{store.address}</p>
        </div>
      </div>

      <div className="px-1 pb-1 pt-4">
        <div className="grid grid-cols-3 gap-2 text-xs font-semibold">
          <div className="rounded bg-zinc-50 px-3 py-3 text-zinc-700">
            <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-400">Llegada</p>
            <p className="mt-1">{etaLabel(store)}</p>
          </div>
          <div className="rounded bg-zinc-50 px-3 py-3 text-zinc-700">
            <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-400">Envio</p>
            <p className="mt-1">{deliveryPriceLabel(store)}</p>
          </div>
          <div className="rounded bg-zinc-50 px-3 py-3 text-zinc-700">
            <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-400">Pago</p>
            <p className="mt-1">{paymentLabel(store)}</p>
          </div>
        </div>

        <p className="mt-4 line-clamp-2 text-sm leading-6 text-zinc-600">{store.description}</p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="line-clamp-1 text-xs font-medium text-zinc-500">
            {store.opening_note ?? (store.accepting_orders ? "Tomando pedidos" : "Pedidos pausados")}
          </p>
          <span className="rounded bg-ink px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white">
            Ver tienda
          </span>
        </div>
      </div>
    </Link>
  );
}

export function HomePage() {
  const { isAuthenticated, loading: sessionLoading, register, user } = useSession();
  const { itemCount, storeName, total } = useCart();
  const [categories, setCategories] = useState<Category[]>([]);
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [categorySlug, setCategorySlug] = useState("");
  const [search, setSearch] = useState("");
  const [deliveryMode, setDeliveryMode] = useState<"" | "delivery" | "pickup">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
  const deliveryStores = useMemo(
    () => stores.filter((store) => store.delivery_settings.delivery_enabled).length,
    [stores]
  );
  const pickupStores = useMemo(
    () => stores.filter((store) => store.delivery_settings.pickup_enabled).length,
    [stores]
  );
  const mpStores = useMemo(() => stores.filter((store) => hasMercadoPago(store)).length, [stores]);
  const featuredCategories = useMemo(() => categories.slice(0, 8), [categories]);
  const spotlightStores = useMemo(() => {
    const openFirst = stores.filter((store) => store.is_open);
    return (openFirst.length ? openFirst : stores).slice(0, 6);
  }, [stores]);

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      await register(fullName, email, password);
      setFullName("");
      setEmail("");
      setPassword("");
      setSubmitSuccess("Cuenta creada. Ya puedes guardar direcciones, seguir pedidos y comprar.");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "No se pudo crear la cuenta");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 pb-[calc(var(--bottom-nav-height)+var(--mobile-cart-cta-height)+2.5rem+var(--safe-bottom))] md:space-y-7 md:pb-8">
      <section className="rounded border border-[#ead9ca] bg-white p-4 shadow-sm md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded border border-[#ead9ca] bg-[#fff7f1] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-700">
            <span className="h-2.5 w-2.5 rounded bg-emerald-500" />
            Pedir ahora
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/merchant-apply"
              className="rounded border border-black/10 bg-zinc-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-700"
            >
              Vender
            </Link>
            <Link
              to="/delivery-apply"
              className="rounded border border-black/10 bg-zinc-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-700"
            >
              Repartir
            </Link>
            <Link
              to={isAuthenticated && user ? roleHome[user.role] : "/login"}
              className="rounded bg-ink px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white shadow-float"
            >
              {isAuthenticated && user ? "Mi cuenta" : "Ingresar"}
            </Link>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr] lg:items-stretch">
          <div className="rounded bg-[linear-gradient(145deg,#1a1413,#2a1a16_48%,#4a220f)] p-4 text-white shadow-float md:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#ffd2bd]/76">Comercios activos</p>
            <h1 className="mt-3 font-display text-[2rem] font-bold leading-[1.02] tracking-tight md:text-[2.55rem]">
              Pide en tiendas abiertas, con delivery o retiro.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/72">
              Busca por rubro, filtra por entrega y entra directo a la tienda para armar tu pedido.
            </p>

            <div className="mt-5 rounded border border-white/10 bg-white/10 p-3 backdrop-blur">
              <label className="block">
                <span className="sr-only">Buscar comercio</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar comidas, farmacia, kiosco, despensa..."
                  className="w-full rounded border border-white/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-500"
                />
              </label>

              <div className="mt-3 flex gap-2 overflow-x-auto hide-scrollbar">
                {[
                  { value: "", label: "Todo" },
                  { value: "delivery", label: "Delivery" },
                  { value: "pickup", label: "Retiro" }
                ].map((item) => (
                  <button
                    key={item.value || "all"}
                    type="button"
                    onClick={() => setDeliveryMode(item.value as "" | "delivery" | "pickup")}
                    className={`whitespace-nowrap rounded px-4 py-2.5 text-sm font-semibold transition ${
                      deliveryMode === item.value
                        ? "bg-white text-ink shadow-float"
                        : "border border-white/15 bg-white/10 text-white/88"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="mt-3 flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                <button
                  type="button"
                  onClick={() => setCategorySlug("")}
                  className={`whitespace-nowrap rounded px-4 py-2.5 text-sm font-semibold transition ${
                    !categorySlug ? "bg-brand-500 text-white shadow-float" : "bg-white/10 text-white/84"
                  }`}
                >
                  Todos los rubros
                </button>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setCategorySlug(category.slug)}
                    className={`whitespace-nowrap rounded px-4 py-2.5 text-sm font-semibold transition ${
                      categorySlug === category.slug
                        ? "bg-brand-500 text-white shadow-float"
                        : "bg-white/10 text-white/84"
                    }`}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded border border-[#ead9ca] bg-[#fff7f1] px-4 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">Abiertos</p>
              <p className="mt-2 font-display text-3xl font-bold tracking-tight text-ink">{openStores}</p>
              <p className="mt-1 text-xs text-zinc-500">Tomando pedidos ahora</p>
            </div>
            <div className="rounded border border-[#ead9ca] bg-white px-4 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">Delivery</p>
              <p className="mt-2 font-display text-3xl font-bold tracking-tight text-ink">{deliveryStores}</p>
              <p className="mt-1 text-xs text-zinc-500">Con envio disponible</p>
            </div>
            <div className="rounded border border-[#ead9ca] bg-white px-4 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">Retiro</p>
              <p className="mt-2 font-display text-3xl font-bold tracking-tight text-ink">{pickupStores}</p>
              <p className="mt-1 text-xs text-zinc-500">Listos para pasar a buscar</p>
            </div>
            <div className="rounded border border-[#ead9ca] bg-white px-4 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">Pago online</p>
              <p className="mt-2 font-display text-3xl font-bold tracking-tight text-ink">{mpStores}</p>
              <p className="mt-1 text-xs text-zinc-500">Aceptan Mercado Pago</p>
            </div>
          </div>
        </div>
      </section>

      {featuredCategories.length ? (
        <section className="space-y-4">
          <SectionHeading
            eyebrow="Rubros"
            title="Explora por categoria"
            description="Atajos rapidos para entrar a lo que quieres pedir."
          />
          <div className="flex gap-3 overflow-x-auto pb-1 hide-scrollbar">
            {featuredCategories.map((category) => (
              <CategoryShortcut
                key={category.id}
                category={category}
                active={categorySlug === category.slug}
                onClick={() => setCategorySlug(category.slug)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <SectionHeading
          eyebrow="Listas rapidas"
          title="Accesos para pedir mas rapido"
          description="Cambia el foco del catalogo con un toque."
        />
        <div className="flex gap-3 overflow-x-auto pb-1 hide-scrollbar">
          <QuickCollectionCard
            label="Activos"
            title="Abiertos ahora"
            value={String(openStores)}
            subtitle="Tiendas que ya estan aceptando pedidos."
          />
          <QuickCollectionCard
            label="Delivery"
            title="Con envio"
            value={String(deliveryStores)}
            subtitle="Filtra locales con reparto disponible."
            active={deliveryMode === "delivery"}
            onClick={() => setDeliveryMode("delivery")}
          />
          <QuickCollectionCard
            label="Retiro"
            title="Listos para retirar"
            value={String(pickupStores)}
            subtitle="Muestra comercios que permiten pasar a buscar."
            active={deliveryMode === "pickup"}
            onClick={() => setDeliveryMode("pickup")}
          />
          <QuickCollectionCard
            label="Pago online"
            title="Mercado Pago"
            value={String(mpStores)}
            subtitle="Tiendas con cobro online habilitado."
          />
        </div>
      </section>

      {spotlightStores.length ? (
        <section id="destacados" className="space-y-4">
          <SectionHeading
            eyebrow="Destacados"
            title="Tiendas para pedir rapido"
            description="Una fila corta para entrar directo a comercios abiertos y faciles de explorar."
          />
          <div className="flex gap-3 overflow-x-auto pb-1 hide-scrollbar">
            {spotlightStores.map((store) => (
              <MiniStoreCard key={store.id} store={store} />
            ))}
          </div>
        </section>
      ) : null}

      <section id="comercios-activos" className="space-y-4">
        <div className="rounded border border-[#ead9ca] bg-white/95 p-4 shadow-sm">
          <SectionHeading
            eyebrow="Catalogo"
            title="Comercios activos"
            description="Abiertos primero, luego cerrados por proxima apertura. Entra directo a la tienda y arma tu pedido."
            action={
              <span className="rounded bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-600">
                {stores.length} resultados
              </span>
            }
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {categorySlug ? (
              <button
                type="button"
                onClick={() => setCategorySlug("")}
                className="rounded border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700"
              >
                Rubro activo
              </button>
            ) : null}
            {deliveryMode ? (
              <button
                type="button"
                onClick={() => setDeliveryMode("")}
                className="rounded border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700"
              >
                {deliveryMode === "delivery" ? "Delivery" : "Retiro"}
              </button>
            ) : null}
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="rounded border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700"
              >
                Buscar: {search}
              </button>
            ) : null}
            {categorySlug || deliveryMode || search ? (
              <button
                type="button"
                onClick={() => {
                  setCategorySlug("");
                  setSearch("");
                  setDeliveryMode("");
                }}
                className="rounded border border-black/10 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-700"
              >
                Limpiar filtros
              </button>
            ) : null}
          </div>
        </div>

        {loading ? <LoadingCard label="Cargando comercios..." /> : null}
        {error ? <EmptyCard title="No se pudo cargar el catalogo" description={error} /> : null}

        {!loading && !error ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {stores.map((store) => (
              <StoreCard key={store.id} store={store} />
            ))}
            {!stores.length ? (
              <div className="xl:col-span-2">
                <EmptyCard
                  title="No hay comercios para ese filtro"
                  description="Prueba con otro rubro, cambia el modo de entrega o limpia la busqueda."
                  action={
                    <button
                      type="button"
                      onClick={() => {
                        setCategorySlug("");
                        setSearch("");
                        setDeliveryMode("");
                      }}
                      className="rounded bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-float"
                    >
                      Limpiar filtros
                    </button>
                  }
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div id="registro-cliente" className="rounded border border-[#ead9ca] bg-white p-5 shadow-sm md:p-6">
          {!isAuthenticated ? (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-400">Cuenta cliente</p>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink">
                Crea tu cuenta para pedir mas rapido
              </h2>
              <p className="mt-3 text-sm leading-7 text-zinc-600">
                Guarda direcciones, vuelve mas rapido al checkout y sigue tus pedidos desde una sola cuenta.
              </p>

              <form onSubmit={(event) => void handleRegister(event)} className="mt-5 space-y-4">
                <label className="block space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Nombre completo</span>
                  <input
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    required
                    className="w-full rounded border border-black/10 bg-zinc-50 px-4 py-3 outline-none transition focus:border-brand-500"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    className="w-full rounded border border-black/10 bg-zinc-50 px-4 py-3 outline-none transition focus:border-brand-500"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Contrasena</span>
                  <div className="flex items-center gap-2 rounded border border-black/10 bg-zinc-50 px-4 py-1.5">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      minLength={6}
                      className="min-w-0 flex-1 bg-transparent py-3 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="shrink-0 rounded bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600"
                    >
                      {showPassword ? "Ocultar" : "Mostrar"}
                    </button>
                  </div>
                </label>
                {submitError ? (
                  <p className="rounded bg-rose-50 px-4 py-3 text-sm text-rose-700">{submitError}</p>
                ) : null}
                {submitSuccess ? (
                  <p className="rounded bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{submitSuccess}</p>
                ) : null}
                <button
                  type="submit"
                  disabled={submitting || sessionLoading}
                  className="w-full rounded bg-[linear-gradient(135deg,#fb923c,#c2410c)] px-4 py-3 text-sm font-semibold text-white shadow-float transition disabled:cursor-not-allowed disabled:bg-zinc-300"
                >
                  {submitting || sessionLoading ? "Creando cuenta..." : "Crear cuenta cliente"}
                </button>
              </form>

              <p className="mt-4 text-sm text-zinc-500">
                Ya tienes cuenta.{" "}
                <Link to="/login" className="font-semibold text-brand-700">
                  Ingresar
                </Link>
              </p>
            </>
          ) : (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-400">Sesion activa</p>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink">
                {user?.role === "customer" ? "Tu cuenta ya esta lista para comprar" : "Tu acceso ya esta activo"}
              </h2>
              <p className="mt-3 text-sm leading-7 text-zinc-600">
                {user?.role === "customer"
                  ? "Puedes volver al carrito, guardar direcciones o seguir tus pedidos desde el flujo de compra."
                  : "Puedes seguir explorando el catalogo o volver a tu panel operativo cuando lo necesites."}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  to={user ? roleHome[user.role] : "/"}
                  className="rounded bg-ink px-4 py-3 text-sm font-semibold text-white shadow-float"
                >
                  {user?.role === "customer" ? "Seguir comprando" : "Ir a mi panel"}
                </Link>
                <Link
                  to="/orders"
                  className="rounded border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-zinc-700"
                >
                  Ver pedidos
                </Link>
              </div>
            </>
          )}
        </div>

        <div className="rounded border border-[#ead9ca] bg-white p-5 shadow-sm md:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-400">Cuenta y postulaciones</p>
          <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink">Otros accesos</h2>
          <div className="mt-5 space-y-3">
            <Link
              to={isAuthenticated && user ? roleHome[user.role] : "/login"}
              className="flex items-center justify-between rounded border border-black/10 bg-zinc-50 px-4 py-4 text-sm font-semibold text-zinc-700"
            >
              <span>{isAuthenticated && user ? "Ir a mi cuenta" : "Ingresar con mi cuenta"}</span>
              <span className="text-zinc-400">{">"}</span>
            </Link>
            <Link
              to="/merchant-apply"
              className="flex items-center justify-between rounded border border-black/10 bg-zinc-50 px-4 py-4 text-sm font-semibold text-zinc-700"
            >
              <span>Solicitud de vendedor</span>
              <span className="text-zinc-400">{">"}</span>
            </Link>
            <Link
              to="/delivery-apply"
              className="flex items-center justify-between rounded border border-black/10 bg-zinc-50 px-4 py-4 text-sm font-semibold text-zinc-700"
            >
              <span>Solicitud de rider</span>
              <span className="text-zinc-400">{">"}</span>
            </Link>
          </div>
        </div>
      </section>

      {itemCount > 0 ? (
        <div className="fixed bottom-[calc(var(--bottom-nav-height)+1rem+var(--safe-bottom))] left-4 right-4 z-30 md:hidden">
          <Link
            to="/cart"
            className="mx-auto flex max-w-md items-center justify-between gap-3 rounded bg-ink px-4 py-4 text-white shadow-[0_22px_44px_rgba(24,19,18,0.28)]"
          >
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/55">Carrito activo</p>
              <p className="mt-1 truncate text-sm font-semibold">{itemCount} productos en {storeName ?? "tu pedido"}</p>
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
