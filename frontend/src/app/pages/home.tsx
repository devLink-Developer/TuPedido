import { useEffect, useMemo, useState, type FormEvent } from "react";
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

function StoreCard({ store }: { store: StoreSummary }) {
  return (
    <Link
      to={`/stores/${store.slug}`}
      className="group rounded-[28px] border border-white/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div className="flex items-start gap-3">
        <div
          className="h-24 w-24 shrink-0 rounded-[22px] bg-[linear-gradient(135deg,#1f1715,#8a3c12)]"
          style={
            store.cover_image_url
              ? {
                  backgroundImage: `linear-gradient(180deg, rgba(24,24,27,0.06), rgba(24,24,27,0.6)), url(${store.cover_image_url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center"
                }
              : undefined
          }
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-400">
                {store.primary_category ?? store.categories[0] ?? "Comercio"}
              </p>
              <h3 className="mt-1 truncate text-lg font-black tracking-tight text-ink">{store.name}</h3>
            </div>
            <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
              {store.rating.toFixed(1)}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold">
            <span
              className={`rounded-full px-3 py-1 ${
                store.is_open ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
              }`}
            >
              {store.is_open ? "Abierto ahora" : "Cerrado"}
            </span>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-zinc-600">{etaLabel(store)}</span>
          </div>
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-zinc-600">{store.description}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-semibold text-zinc-600">
        <div className="rounded-[18px] bg-zinc-50 px-3 py-3">
          <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-400">Entrega</p>
          <p className="mt-1">
            {store.delivery_settings.delivery_enabled
              ? formatCurrency(store.delivery_settings.delivery_fee)
              : "Solo retiro"}
          </p>
        </div>
        <div className="rounded-[18px] bg-zinc-50 px-3 py-3">
          <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-400">Pago</p>
          <p className="mt-1">{paymentLabel(store)}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="line-clamp-1 text-xs font-medium text-zinc-500">
          {store.opening_note ?? (store.accepting_orders ? "Tomando pedidos" : "Pedidos pausados")}
        </p>
        <span className="rounded-full bg-ink px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white">
          Ver tienda
        </span>
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
    <div className="space-y-5 pb-[calc(var(--bottom-nav-height)+var(--mobile-cart-cta-height)+2.5rem+var(--safe-bottom))] md:space-y-6 md:pb-8">
      <section className="ambient-grid overflow-hidden rounded-[34px] bg-[linear-gradient(160deg,#1a1413_0%,#241715_45%,#5d260e_100%)] px-5 py-6 text-white shadow-lift md:px-7 md:py-7">
        <div className="absolute -right-10 top-0 h-36 w-36 rounded-full bg-brand-400/25 blur-3xl orb-float" />
        <div className="relative space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#ffd2bd]/80">
                Delivery del barrio
              </p>
              <h1 className="mt-3 font-display text-[2rem] font-bold leading-[1.02] tracking-tight md:text-[3.2rem]">
                Pide en comercios activos sin perder tiempo en pantallas vacias.
              </h1>
              <p className="mt-3 max-w-lg text-sm leading-7 text-white/72 md:text-base">
                Despensas, kioscos, farmacias, carnicerias y restaurantes listos para vender desde el primer scroll.
              </p>
            </div>
            <span className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/82">
              {openStores} abiertos ahora
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-[24px] border border-white/10 bg-white/10 px-4 py-4 backdrop-blur">
              <p className="font-display text-2xl font-bold">{stores.length}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                Activos
              </p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/10 px-4 py-4 backdrop-blur">
              <p className="font-display text-2xl font-bold">{deliveryStores}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                Delivery
              </p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/10 px-4 py-4 backdrop-blur">
              <p className="font-display text-2xl font-bold">{pickupStores}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                Retiro
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href="#comercios-activos"
              className="rounded-full bg-white px-4 py-3 text-sm font-semibold text-ink shadow-float"
            >
              Ver comercios activos
            </a>
            <Link
              to="/merchant-apply"
              className="rounded-full border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white"
            >
              Quiero vender
            </Link>
            <Link
              to="/delivery-apply"
              className="rounded-full border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white/90"
            >
              Quiero repartir
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {[
          "Compra con delivery o retiro sin salir del catalogo.",
          "Compara tiempos, medios de pago y costo de envio al instante.",
          "El servicio de plataforma se ve claro antes de confirmar."
        ].map((item) => (
          <div key={item} className="rounded-[24px] border border-[#ead9ca] bg-white/92 px-4 py-4 text-sm leading-6 text-zinc-600 shadow-sm">
            {item}
          </div>
        ))}
      </section>

      <section id="comercios-activos" className="space-y-4">
        <div className="rounded-[30px] border border-[#ead9ca] bg-white/95 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-400">Explorar</p>
              <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink">
                Comercios activos
              </h2>
            </div>
            <span className="rounded-full bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-600">
              {stores.length} resultados
            </span>
          </div>

          <label className="mt-4 block space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Buscar comercio o rubro</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Farmacia, pizza, despensa..."
              className="w-full rounded-[22px] border border-black/10 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:border-brand-500"
            />
          </label>

          <div className="mt-4 flex gap-2 overflow-x-auto hide-scrollbar">
            {[
              { value: "", label: "Todo" },
              { value: "delivery", label: "Delivery" },
              { value: "pickup", label: "Retiro" }
            ].map((item) => (
              <button
                key={item.value || "all"}
                type="button"
                onClick={() => setDeliveryMode(item.value as "" | "delivery" | "pickup")}
                className={`whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                  deliveryMode === item.value
                    ? "bg-ink text-white shadow-float"
                    : "border border-black/10 bg-white text-zinc-600"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
            <button
              type="button"
              onClick={() => setCategorySlug("")}
              className={`whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                !categorySlug ? "bg-brand-500 text-white shadow-float" : "bg-zinc-100 text-zinc-600"
              }`}
            >
              Todos los rubros
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setCategorySlug(category.slug)}
                className={`whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                  categorySlug === category.slug ? "bg-brand-500 text-white shadow-float" : "bg-zinc-100 text-zinc-600"
                }`}
              >
                {category.name}
              </button>
            ))}
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
                      className="rounded-full bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-float"
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
        <div id="registro-cliente" className="rounded-[32px] border border-[#ead9ca] bg-white p-5 shadow-sm md:p-6">
          {!isAuthenticated ? (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-400">Cuenta cliente</p>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink">
                Crea tu cuenta y empieza a pedir
              </h2>
              <p className="mt-3 text-sm leading-7 text-zinc-600">
                Guarda direcciones, sigue pedidos y compra sin repetir tus datos en cada checkout.
              </p>

              <form onSubmit={(event) => void handleRegister(event)} className="mt-5 space-y-4">
                <label className="block space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Nombre completo</span>
                  <input
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    required
                    className="w-full rounded-[22px] border border-black/10 bg-zinc-50 px-4 py-3 outline-none transition focus:border-brand-500"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    className="w-full rounded-[22px] border border-black/10 bg-zinc-50 px-4 py-3 outline-none transition focus:border-brand-500"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Contrasena</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={6}
                    className="w-full rounded-[22px] border border-black/10 bg-zinc-50 px-4 py-3 outline-none transition focus:border-brand-500"
                  />
                </label>
                {submitError ? (
                  <p className="rounded-[22px] bg-rose-50 px-4 py-3 text-sm text-rose-700">{submitError}</p>
                ) : null}
                {submitSuccess ? (
                  <p className="rounded-[22px] bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{submitSuccess}</p>
                ) : null}
                <button
                  type="submit"
                  disabled={submitting || sessionLoading}
                  className="w-full rounded-full bg-[linear-gradient(135deg,#fb923c,#c2410c)] px-4 py-3 text-sm font-semibold text-white shadow-float transition disabled:cursor-not-allowed disabled:bg-zinc-300"
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
                  : "Puedes seguir explorando el marketplace o volver a tu panel operativo cuando lo necesites."}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  to={user ? roleHome[user.role] : "/"}
                  className="rounded-full bg-ink px-4 py-3 text-sm font-semibold text-white shadow-float"
                >
                  {user?.role === "customer" ? "Seguir comprando" : "Ir a mi panel"}
                </Link>
                <Link
                  to="/orders"
                  className="rounded-full border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-zinc-700"
                >
                  Ver pedidos
                </Link>
              </div>
            </>
          )}
        </div>

        <div className="ambient-grid overflow-hidden rounded-[32px] bg-[linear-gradient(165deg,#1b1514_0%,#2b1814_58%,#4a230f_100%)] p-5 text-white shadow-lift md:p-6">
          <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-brand-400/20 blur-3xl" />
          <div className="relative">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#ffd2bd]/80">Para comercios</p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight">
              Suma tu negocio y vende sin inflar tus productos por comisiones.
            </h2>
            <p className="mt-3 text-sm leading-7 text-white/74">
              Publica catalogo, horarios, envio o retiro, cobros y seguimiento de pedidos desde un panel propio.
            </p>

            <div className="mt-5 space-y-3 text-sm text-white/80">
              {[
                "Gestion de catalogo, horarios y medios de pago.",
                "Pedidos centralizados con estados claros para el cliente.",
                "Solicitud separada del registro cliente, sin mezclar flujos."
              ].map((item) => (
                <div key={item} className="rounded-[22px] border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
                  {item}
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                to="/merchant-apply"
                className="inline-flex rounded-full bg-white px-4 py-3 text-sm font-semibold text-ink shadow-float"
              >
                Aplicar como vendedor
              </Link>
              <Link
                to="/delivery-apply"
                className="inline-flex rounded-full border border-white/15 px-4 py-3 text-sm font-semibold text-white/90"
              >
                Aplicar como rider
              </Link>
            </div>
          </div>
        </div>
      </section>

      {itemCount > 0 ? (
        <div className="fixed bottom-[calc(var(--bottom-nav-height)+1rem+var(--safe-bottom))] left-4 right-4 z-30 md:hidden">
          <Link
            to="/cart"
            className="mx-auto flex max-w-md items-center justify-between gap-3 rounded-[26px] bg-ink px-4 py-4 text-white shadow-[0_22px_44px_rgba(24,19,18,0.28)]"
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
