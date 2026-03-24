import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  checkout,
  createAddress,
  createMerchantApplication,
  deleteAddress,
  fetchAddresses,
  fetchCategories,
  fetchMerchantApplications,
  fetchOrder,
  fetchOrderTracking,
  fetchOrders,
  fetchStore,
  updateAddress
} from "../api";
import { useOrderLiveTracking } from "../hooks/useOrderLiveTracking";
import { useCart } from "../../features/cart/cart-store";
import { useSession } from "../session";
import type { Address, Category, MerchantApplication, Order, OrderTracking, StoreDetail } from "../types";
import { LiveMap } from "../../components/maps/LiveMap";
import {
  EmptyCard,
  LoadingCard,
  PageHeader,
  formatCurrency,
  normalizePath,
  orderStatusOptions,
  paymentMethodLabels,
  roleHome,
  statusLabels
} from "./common";

type AddressFormState = {
  label: string;
  street: string;
  details: string;
  latitude: string;
  longitude: string;
  is_default: boolean;
};

const emptyAddressForm: AddressFormState = {
  label: "",
  street: "",
  details: "",
  latitude: "",
  longitude: "",
  is_default: false
};

function StatusPill({ value }: { value: string }) {
  return <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">{statusLabels[value] ?? value}</span>;
}

function hasMercadoPago(paymentSettings: StoreDetail["payment_settings"]) {
  return paymentSettings.mercadopago_enabled && paymentSettings.mercadopago_configured;
}

const mercadoPagoSimulated = (import.meta.env.VITE_MERCADOPAGO_SIMULATED ?? "true") === "true";

function paymentStatusMessage(paymentStatus: string) {
  switch (paymentStatus) {
    case "approved":
      return "Pago aprobado. El comercio ya puede continuar con la preparacion.";
    case "pending":
      return "Pago pendiente. Mercado Pago todavia no confirmo la acreditacion.";
    case "rejected":
      return "Pago rechazado. Te conviene intentar nuevamente con otro medio.";
    case "cancelled":
      return "Pago cancelado. El pedido no seguira avanzando.";
    default:
      return "Estado de pago actualizado por Mercado Pago.";
  }
}

export function CartPage() {
  const { cart, loading, error, updateItem, removeItem, setDeliveryMode, clear, refreshCart } = useCart();
  const [savingItemId, setSavingItemId] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    void refreshCart();
  }, [refreshCart]);

  async function adjust(itemId: number, quantity: number) {
    setSavingItemId(itemId);
    try {
      await updateItem(itemId, { quantity: Math.max(1, quantity) });
    } finally {
      setSavingItemId(null);
    }
  }

  if (loading) return <LoadingCard />;
  if (error) return <EmptyCard title="No se pudo cargar el carrito" description={error} />;
  if (!cart || !cart.items.length) {
    return (
      <EmptyCard
        title="Carrito vacio"
        description="Explora comercios adheridos y arma tu pedido desde una tienda que ya este lista para vender."
        action={
          <Link to="/" className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white">
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
        description="El carrito vive en el backend y se mantiene sincronizado en todos los dispositivos."
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
                  {mode === "delivery" ? "Envío" : "Retiro"}
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
                    onClick={() => void adjust(item.id, item.quantity - 1)}
                    disabled={savingItemId === item.id}
                  >
                    -
                  </button>
                  <span className="min-w-10 px-3 text-center text-sm font-bold">{item.quantity}</span>
                  <button
                    type="button"
                    className="rounded-full px-3 py-2 text-sm font-semibold text-zinc-600"
                    onClick={() => void adjust(item.id, item.quantity + 1)}
                    disabled={savingItemId === item.id}
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
          <div className="rounded-[28px] bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold">Resumen</h3>
            <div className="mt-4 space-y-3 text-sm text-zinc-600">
              <div className="flex items-center justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(cart.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Envío</span>
                <span>{formatCurrency(cart.delivery_fee)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Servicio</span>
                <span>{formatCurrency(cart.service_fee)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-black/5 pt-3 text-base font-bold text-ink">
                <span>Total</span>
                <span>{formatCurrency(cart.total)}</span>
              </div>
            </div>
            <button type="button" onClick={() => navigate("/checkout")} className="mt-4 w-full rounded-full bg-brand-500 px-4 py-3 text-sm font-semibold text-white">
              Ir a pagar
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function AddressesPage() {
  const { token } = useSession();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [form, setForm] = useState<AddressFormState>(emptyAddressForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setAddresses(await fetchAddresses(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las direcciones");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  function resetForm() {
    setForm(emptyAddressForm);
    setEditingId(null);
  }

  function startEdit(address: Address) {
    setEditingId(address.id);
    setForm({
      label: address.label,
      street: address.street,
      details: address.details,
      latitude: address.latitude?.toString() ?? "",
      longitude: address.longitude?.toString() ?? "",
      is_default: address.is_default
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null
      };
      if (editingId) {
        await updateAddress(token, editingId, payload);
      } else {
        await createAddress(token, payload);
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la direccion");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await deleteAddress(token, id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la direccion");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Direcciones" title="Tus direcciones" description="Mantenelas listas para el checkout y el backend las usa como origen del envio." />
      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4 rounded-[28px] bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold">{editingId ? "Editar direccion" : "Nueva direccion"}</h3>
          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Etiqueta</span>
            <input
              value={form.label}
              onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
              className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Calle</span>
            <input
              value={form.street}
              onChange={(event) => setForm((current) => ({ ...current, street: event.target.value }))}
              className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Detalles</span>
            <textarea
              value={form.details}
              onChange={(event) => setForm((current) => ({ ...current, details: event.target.value }))}
              rows={4}
              className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Latitud</span>
              <input
                value={form.latitude}
                onChange={(event) => setForm((current) => ({ ...current, latitude: event.target.value }))}
                className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
                placeholder="-34.56"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Longitud</span>
              <input
                value={form.longitude}
                onChange={(event) => setForm((current) => ({ ...current, longitude: event.target.value }))}
                className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
                placeholder="-58.45"
              />
            </label>
          </div>
          <label className="flex items-center gap-3 text-sm font-semibold">
            <input type="checkbox" checked={form.is_default} onChange={(event) => setForm((current) => ({ ...current, is_default: event.target.checked }))} />
            Usar como direccion principal
          </label>
          {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="rounded-full bg-brand-500 px-4 py-3 text-sm font-semibold text-white disabled:bg-zinc-300">
              {saving ? "Guardando..." : "Guardar"}
            </button>
            {editingId ? (
              <button type="button" onClick={resetForm} className="rounded-full bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-700">
                Cancelar
              </button>
            ) : null}
          </div>
        </form>

        <div className="space-y-3">
          {loading ? <LoadingCard /> : null}
          {addresses.map((address) => (
            <article key={address.id} className="rounded-[28px] bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold">{address.label}</h3>
                  <p className="mt-1 text-sm text-zinc-600">{address.street}</p>
                  <p className="mt-1 text-sm text-zinc-500">{address.details}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-400">
                    {address.latitude !== null && address.longitude !== null ? `${address.latitude}, ${address.longitude}` : "Sin pin de mapa"}
                  </p>
                </div>
                {address.is_default ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Principal</span> : null}
              </div>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => startEdit(address)} className="rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700">
                  Editar
                </button>
                <button type="button" onClick={() => void handleDelete(address.id)} className="rounded-full bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700">
                  Eliminar
                </button>
              </div>
            </article>
          ))}
          {!addresses.length && !loading ? <EmptyCard title="Sin direcciones" description="Creá tu primera direccion para seguir." /> : null}
        </div>
      </div>
    </div>
  );
}

export function OrdersPage() {
  const { token, user } = useSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchOrders(token)
      .then((items) => {
        if (!cancelled) setOrders(items);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "No se pudieron cargar los pedidos");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Pedidos" title="Historial de pedidos" description={user?.role === "customer" ? "Tus pedidos creados, pagos y entregas." : "Vista unificada del backend para el rol actual."} />
      {loading ? <LoadingCard /> : null}
      {error ? <EmptyCard title="No se pudieron cargar los pedidos" description={error} /> : null}
      <div className="space-y-4">
        {orders.map((order) => (
          <Link key={order.id} to={`/orders/${order.id}`} className="block rounded-[28px] bg-white p-5 shadow-sm transition hover:-translate-y-0.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">{order.store_name}</h3>
                <p className="mt-1 text-sm text-zinc-600">{order.customer_name}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusPill value={order.status} />
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">{paymentMethodLabels[order.payment_method]}</span>
              </div>
            </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-600">
                <span>{order.delivery_mode === "delivery" ? "Envio" : "Retiro"}</span>
                <span>{formatCurrency(order.total)}</span>
                <span>{statusLabels[order.payment_status] ?? order.payment_status}</span>
                <span>{new Date(order.created_at).toLocaleString("es-AR")}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-zinc-500">
                <span>Servicio: {formatCurrency(order.service_fee)}</span>
                <span>Subtotal: {formatCurrency(order.subtotal)}</span>
              </div>
          </Link>
        ))}
        {!orders.length && !loading ? <EmptyCard title="Sin pedidos" description="Cuando confirmes una compra aparecerá aca." /> : null}
      </div>
    </div>
  );
}

export function OrderDetailPage() {
  const { id } = useParams();
  const { token } = useSession();
  const [order, setOrder] = useState<Order | null>(null);
  const [tracking, setTracking] = useState<OrderTracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const orderId = id ? Number(id) : null;

  useEffect(() => {
    if (!token || !orderId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([fetchOrder(token, orderId), fetchOrderTracking(token, orderId)])
      .then(([item, trackingData]) => {
        if (cancelled) return;
        setOrder(item);
        setTracking(trackingData);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "No se pudo cargar el pedido");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, token]);

  const handleOrderUpdate = useCallback((value: Order) => setOrder(value), []);
  const handleTrackingUpdate = useCallback((value: OrderTracking) => setTracking(value), []);

  useOrderLiveTracking({
    token,
    orderId,
    enabled: Boolean(orderId && token),
    onOrder: handleOrderUpdate,
    onTracking: handleTrackingUpdate,
    onError: setError
  });

  if (loading) return <LoadingCard />;
  if (error) return <EmptyCard title="Pedido no disponible" description={error} />;
  if (!order) return <EmptyCard title="Pedido inexistente" description="No encontramos ese pedido." />;

  const liveTracking = tracking ?? {
    order_id: order.id,
    status: order.status,
    delivery_status: order.delivery_status,
    delivery_provider: order.delivery_provider,
    tracking_enabled: order.delivery_provider === "platform",
    assigned_rider_id: order.assigned_rider_id,
    assigned_rider_name: order.assigned_rider_name,
    assigned_rider_phone_masked: order.assigned_rider_phone_masked,
    assigned_rider_vehicle_type: order.assigned_rider_vehicle_type,
    store_latitude: order.store_latitude,
    store_longitude: order.store_longitude,
    address_latitude: order.address_latitude,
    address_longitude: order.address_longitude,
    tracking_last_latitude: order.tracking_last_latitude,
    tracking_last_longitude: order.tracking_last_longitude,
    tracking_last_at: order.tracking_last_at,
    tracking_stale: order.tracking_stale,
    eta_minutes: order.eta_minutes,
    otp_required: order.otp_required,
    otp_code: null
  };
  const mapPoints = [
    liveTracking.store_latitude !== null && liveTracking.store_longitude !== null
      ? {
          id: "store",
          latitude: liveTracking.store_latitude,
          longitude: liveTracking.store_longitude,
          color: "linear-gradient(135deg,#f97316,#c2410c)",
          label: "Tienda"
        }
      : null,
    liveTracking.address_latitude !== null && liveTracking.address_longitude !== null
      ? {
          id: "customer",
          latitude: liveTracking.address_latitude,
          longitude: liveTracking.address_longitude,
          color: "linear-gradient(135deg,#1f2937,#111827)",
          label: "Destino"
        }
      : null,
    liveTracking.tracking_last_latitude !== null && liveTracking.tracking_last_longitude !== null
      ? {
          id: "rider",
          latitude: liveTracking.tracking_last_latitude,
          longitude: liveTracking.tracking_last_longitude,
          color: "linear-gradient(135deg,#10b981,#047857)",
          label: "Rider"
        }
      : null
  ].filter(Boolean) as Array<{ id: string; latitude: number; longitude: number; color: string; label: string }>;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Pedido" title={`Pedido #${order.id}`} description={`${order.store_name} - ${new Date(order.created_at).toLocaleString("es-AR")}`} />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="rounded-[28px] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap gap-2">
              <StatusPill value={order.status} />
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">{paymentMethodLabels[order.payment_method]}</span>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">{order.delivery_mode === "delivery" ? "Envio" : "Retiro"}</span>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">{statusLabels[order.payment_status] ?? order.payment_status}</span>
              {order.delivery_provider === "platform" ? (
                <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                  {statusLabels[liveTracking.delivery_status] ?? liveTracking.delivery_status}
                </span>
              ) : null}
            </div>
            <div className="mt-4 space-y-2 text-sm text-zinc-600">
              <p>
                <strong>Cliente:</strong> {order.customer_name}
              </p>
              <p>
                <strong>Direccion:</strong> {order.address_full ?? order.address_label ?? "Retiro en local"}
              </p>
              {order.payment_reference ? (
                <p>
                  <strong>Referencia:</strong> {order.payment_reference}
                </p>
              ) : null}
              {order.payment_method === "mercadopago" && order.payment_reference && mercadoPagoSimulated ? (
                <Link className="inline-flex rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white" to={`/payments/mercadopago/simulated?reference=${encodeURIComponent(order.payment_reference)}`}>
                  Abrir simulador
                </Link>
              ) : null}
            </div>
            {order.payment_method === "mercadopago" ? (
              <div className={`mt-4 rounded-2xl px-4 py-3 text-sm ${order.payment_status === "approved" ? "bg-emerald-50 text-emerald-800" : order.payment_status === "pending" ? "bg-amber-50 text-amber-800" : "bg-rose-50 text-rose-800"}`}>
                {paymentStatusMessage(order.payment_status)}
              </div>
            ) : null}
          </div>
          {order.delivery_provider === "platform" ? (
            <div className="rounded-[28px] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">Seguimiento en vivo</h3>
                  <p className="mt-1 text-sm text-zinc-500">
                    {liveTracking.assigned_rider_name
                      ? `${liveTracking.assigned_rider_name} · ${liveTracking.assigned_rider_vehicle_type ?? "rider"}`
                      : "Esperando asignación de repartidor"}
                  </p>
                </div>
                {liveTracking.eta_minutes ? (
                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">{liveTracking.eta_minutes} min</span>
                ) : null}
              </div>
              {mapPoints.length ? <LiveMap points={mapPoints} className="mt-4 h-60" /> : null}
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                  <p className="font-semibold text-ink">Rider</p>
                  <p className="mt-1">{liveTracking.assigned_rider_name ?? "Sin rider asignado"}</p>
                  {liveTracking.assigned_rider_phone_masked ? <p>{liveTracking.assigned_rider_phone_masked}</p> : null}
                </div>
                <div className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                  <p className="font-semibold text-ink">Entrega segura</p>
                  <p className="mt-1">{liveTracking.otp_required ? "Entrega con OTP activo" : "Sin OTP requerido"}</p>
                  {liveTracking.otp_code ? <p className="mt-1 font-semibold text-brand-700">Código: {liveTracking.otp_code}</p> : null}
                  {liveTracking.tracking_last_at ? (
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-400">
                      Última posición {new Date(liveTracking.tracking_last_at).toLocaleTimeString("es-AR")}
                    </p>
                  ) : null}
                </div>
              </div>
              {liveTracking.tracking_stale ? (
                <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  El GPS del rider quedó desactualizado. Se muestra la última ubicación conocida.
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="rounded-[28px] bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold">Items</h3>
            <div className="mt-4 space-y-3">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-4 rounded-2xl bg-zinc-50 px-4 py-3 text-sm">
                  <div>
                    <p className="font-semibold">{item.product_name}</p>
                    <p className="text-zinc-500">
                      {item.quantity} x {formatCurrency(item.unit_price)}
                    </p>
                    {item.note ? <p className="text-zinc-500">{item.note}</p> : null}
                  </div>
                  <p className="font-bold">{formatCurrency(item.unit_price * item.quantity)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-[28px] bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold">Totales</h3>
            <div className="mt-4 space-y-3 text-sm text-zinc-600">
              <div className="flex items-center justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Envio</span>
                <span>{formatCurrency(order.delivery_fee_customer)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Servicio</span>
                <span>{formatCurrency(order.service_fee)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-black/5 pt-3 text-base font-bold text-ink">
                <span>Total</span>
                <span>{formatCurrency(order.total)}</span>
              </div>
            </div>
          </div>
          <div className="rounded-[28px] bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold">Linea temporal</h3>
            <div className="mt-4 space-y-2">
              {[...orderStatusOptions, "assignment_pending", "assigned", "heading_to_store", "picked_up", "near_customer"].map((status) => (
                <div
                  key={status}
                  className={`rounded-2xl px-4 py-3 text-sm ${status === order.status || status === liveTracking.delivery_status ? "bg-brand-500 text-white" : "bg-zinc-50 text-zinc-600"}`}
                >
                  {statusLabels[status] ?? status}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function MerchantApplyPage() {
  const { isAuthenticated, loading: sessionLoading, login, refresh, register, token, user } = useSession();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [applications, setApplications] = useState<MerchantApplication[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [form, setForm] = useState({
    business_name: "",
    description: "",
    address: "",
    phone: "",
    logo_url: "",
    cover_image_url: ""
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"register" | "login">("register");
  const [authForm, setAuthForm] = useState({ full_name: "", email: "", password: "" });
  const [authError, setAuthError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [categoryList, applicationList] = await Promise.all([
        fetchCategories(),
        token && user?.role === "customer" ? fetchMerchantApplications(token) : Promise.resolve([])
      ]);
      setCategories(categoryList);
      setApplications(applicationList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la postulacion");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAuthenticated && user && user.role !== "customer") {
      navigate(roleHome[user.role], { replace: true });
      return;
    }
    void load();
  }, [isAuthenticated, token, user, navigate]);

  function toggleCategory(id: number) {
    setSelectedCategoryIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setAuthError(null);
    try {
      const profile =
        authMode === "register"
          ? await register(authForm.full_name, authForm.email, authForm.password)
          : await login(authForm.email, authForm.password);
      setAuthForm({ full_name: "", email: "", password: "" });
      if (profile.role !== "customer") {
        navigate(roleHome[profile.role], { replace: true });
        return;
      }
      await refresh();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "No se pudo validar tu cuenta");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await createMerchantApplication(token, {
        business_name: form.business_name,
        description: form.description,
        address: form.address,
        phone: form.phone,
        logo_url: form.logo_url || null,
        cover_image_url: form.cover_image_url || null,
        requested_category_ids: selectedCategoryIds
      });
      setForm({ business_name: "", description: "", address: "", phone: "", logo_url: "", cover_image_url: "" });
      setSelectedCategoryIds([]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar la postulacion");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !categories.length && !isAuthenticated) return <LoadingCard label="Preparando solicitud..." />;

  if (!isAuthenticated) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Vender"
          title="Primero crea o usa tu cuenta de cliente"
          description="La solicitud de vendedor vive en esta pantalla, pero antes necesitas una cuenta cliente para continuar con la postulación."
        />

        <div className="grid gap-4 md:grid-cols-3">
          <div className="mesh-surface rounded-[28px] border border-white/80 p-5 shadow-lift">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Paso 1</p>
            <h3 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink">Cuenta cliente</h3>
            <p className="mt-3 text-sm leading-7 text-zinc-600">Crea tu acceso o entra con tu cuenta actual para continuar desde esta misma ruta.</p>
          </div>
          <div className="mesh-surface rounded-[28px] border border-white/80 p-5 shadow-lift">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Paso 2</p>
            <h3 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink">Solicitud</h3>
            <p className="mt-3 text-sm leading-7 text-zinc-600">Completa los datos del negocio y selecciona los rubros donde quieres aparecer.</p>
          </div>
          <div className="mesh-surface rounded-[28px] border border-white/80 p-5 shadow-lift">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Paso 3</p>
            <h3 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink">Revision admin</h3>
            <p className="mt-3 text-sm leading-7 text-zinc-600">El equipo revisa la solicitud y, si la aprueba, el comercio pasa a tener panel propio.</p>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.02fr_0.98fr]">
          <form onSubmit={(event) => void handleAuthSubmit(event)} className="mesh-surface space-y-4 rounded-[30px] border border-white/80 p-5 shadow-lift">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAuthMode("register")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${authMode === "register" ? "bg-brand-500 text-white" : "bg-white text-zinc-600 shadow-sm"}`}
              >
                Crear cuenta cliente
              </button>
              <button
                type="button"
                onClick={() => setAuthMode("login")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${authMode === "login" ? "bg-brand-500 text-white" : "bg-white text-zinc-600 shadow-sm"}`}
              >
                Ya tengo cuenta
              </button>
            </div>

            {authMode === "register" ? (
              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Nombre completo</span>
                <input
                  value={authForm.full_name}
                  onChange={(event) => setAuthForm((current) => ({ ...current, full_name: event.target.value }))}
                  className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
                  required
                />
              </label>
            ) : null}

            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Email</span>
              <input
                type="email"
                value={authForm.email}
                onChange={(event) => setAuthForm((current) => ({ ...current, email: event.target.value }))}
                className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
                required
              />
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Contraseña</span>
              <input
                type="password"
                minLength={6}
                value={authForm.password}
                onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))}
                className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
                required
              />
            </label>

            {authError ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{authError}</p> : null}

            <button
              type="submit"
              disabled={saving || sessionLoading}
              className="rounded-full bg-brand-500 px-5 py-3 text-sm font-semibold text-white disabled:bg-zinc-300"
            >
              {saving || sessionLoading ? "Procesando..." : authMode === "register" ? "Continuar con la solicitud" : "Ingresar y continuar"}
            </button>
          </form>

          <div className="rounded-[30px] bg-[linear-gradient(180deg,#221816_0%,#171210_100%)] p-5 text-white shadow-lift">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#ffd0ba]/70">Rubros disponibles</p>
            <h3 className="mt-3 font-display text-3xl font-bold tracking-tight">Donde puede aparecer tu negocio</h3>
            <p className="mt-3 text-sm leading-7 text-white/70">
              Despensas, kioskos, farmacias, carnicerias, pollerias, restaurantes y otros rubros ya preparados para mostrarse al cliente final.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {categories.map((category) => (
                <span key={category.id} className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/82">
                  {category.name}
                </span>
              ))}
            </div>
            <p className="mt-5 text-sm text-white/55">
              Cuando termines el alta como cliente, esta misma pantalla te mostrara el formulario completo de solicitud.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Comercio"
        title="Suma tu comercio al marketplace"
        description="Presenta tu negocio para que el equipo admin lo revise y lo publique con panel propio, catalogo, horarios, delivery y medios de pago."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="mesh-surface rounded-[28px] border border-white/80 p-5 shadow-lift">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Operacion</p>
          <h3 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink">Panel del comercio</h3>
          <p className="mt-3 text-sm leading-7 text-zinc-600">Gestion de pedidos, horarios, estado abierto o cerrado y configuracion del local desde un mismo lugar.</p>
        </div>
        <div className="mesh-surface rounded-[28px] border border-white/80 p-5 shadow-lift">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Ventas</p>
          <h3 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink">Catalogo visible</h3>
          <p className="mt-3 text-sm leading-7 text-zinc-600">Tu negocio aparece dentro del rubro correcto con fichas visuales pensadas para captar pedidos.</p>
        </div>
        <div className="mesh-surface rounded-[28px] border border-white/80 p-5 shadow-lift">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Cobro</p>
          <h3 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink">Pagos y entrega</h3>
          <p className="mt-3 text-sm leading-7 text-zinc-600">Configura envio, retiro, efectivo y Mercado Pago segun como opere tu negocio.</p>
        </div>
      </div>

      <form onSubmit={(event) => void handleSubmit(event)} className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="mesh-surface space-y-4 rounded-[30px] border border-white/80 p-5 shadow-lift">
          <div className="rounded-[24px] bg-[#fff7f0] px-4 py-4 text-sm leading-7 text-zinc-600">
            Cuanto mejor presentes el local, mas facil sera aprobarlo y dejarlo listo para captar pedidos desde la portada y el directorio.
          </div>
          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Nombre comercial</span>
            <input
              value={form.business_name}
              onChange={(event) => setForm((current) => ({ ...current, business_name: event.target.value }))}
              className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Descripcion</span>
            <textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              rows={4}
              className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Direccion</span>
            <input
              value={form.address}
              onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
              className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Telefono</span>
            <input
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Logo URL</span>
              <input
                value={form.logo_url}
                onChange={(event) => setForm((current) => ({ ...current, logo_url: event.target.value }))}
                className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Portada URL</span>
              <input
                value={form.cover_image_url}
                onChange={(event) => setForm((current) => ({ ...current, cover_image_url: event.target.value }))}
                className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
              />
            </label>
          </div>
        </div>

        <div className="rounded-[30px] bg-[linear-gradient(180deg,#221816_0%,#171210_100%)] p-5 text-white shadow-lift">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#ffd0ba]/70">Solicitud</p>
          <h3 className="mt-3 font-display text-3xl font-bold tracking-tight">Rubros solicitados</h3>
          <p className="mt-3 text-sm leading-7 text-white/70">
            Selecciona los rubros donde quieres aparecer. El equipo admin podra revisar la presentacion, aprobar el alta o pedir ajustes.
          </p>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => toggleCategory(category.id)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  selectedCategoryIds.includes(category.id) ? "bg-[linear-gradient(135deg,#fb923c,#c2410c)] text-white shadow-float" : "bg-white/10 text-white/76"
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
          <div className="grid gap-3 text-sm text-white/70">
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">Panel para pedidos, estado del local, envio, retiro y configuracion comercial.</div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">Cobro en efectivo y opcion de Mercado Pago con tus propias credenciales.</div>
          </div>
          {error ? <p className="rounded-[22px] bg-rose-500/15 px-4 py-3 text-sm text-rose-100">{error}</p> : null}
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-[linear-gradient(135deg,#fb923c,#c2410c)] px-4 py-3 text-sm font-semibold text-white shadow-float disabled:bg-zinc-400"
          >
            {saving ? "Enviando..." : "Enviar postulacion"}
          </button>
          <p className="text-sm text-white/55">El admin puede aprobar, rechazar o suspender la solicitud antes de publicar el comercio.</p>
        </div>
      </form>

      <div className="space-y-3">
        {loading ? <LoadingCard /> : null}
        {applications.map((application) => (
          <article key={application.id} className="rounded-[28px] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">{application.business_name}</h3>
                <p className="text-sm text-zinc-600">{application.address}</p>
              </div>
              <StatusPill value={application.status} />
            </div>
            <p className="mt-3 text-sm text-zinc-600">{application.description}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-zinc-500">
              {application.requested_category_names.map((name) => (
                <span key={name} className="rounded-full bg-zinc-100 px-3 py-1">
                  {name}
                </span>
              ))}
            </div>
            <p className="mt-3 text-sm text-zinc-500">{application.review_notes ?? "Sin observaciones"}</p>
          </article>
        ))}
        {!applications.length && !loading ? <EmptyCard title="Sin postulaciones" description="Todavia no enviaste ninguna solicitud de comercio." /> : null}
      </div>
    </div>
  );
}

export function CheckoutPage() {
  const { cart } = useCart();
  const { token } = useSession();
  const navigate = useNavigate();
  const checkoutCart = cart;
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [store, setStore] = useState<StoreDetail | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<number | "">("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "mercadopago">("cash");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [redirectingToPayment, setRedirectingToPayment] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !cart?.store_slug) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchAddresses(token), fetchStore(cart.store_slug)])
      .then(([addressList, storeData]) => {
        if (cancelled) return;
        setAddresses(addressList);
        setStore(storeData);
        const defaultAddress = addressList.find((address) => address.is_default) ?? addressList[0];
        setSelectedAddressId(cart.delivery_mode === "delivery" ? defaultAddress?.id ?? "" : "");
        setPaymentMethod(hasMercadoPago(storeData.payment_settings) ? "mercadopago" : "cash");
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "No se pudo preparar el checkout");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cart?.delivery_mode, cart?.store_slug, token]);

  const availableMethods = useMemo(() => {
    if (!store) return ["cash", "mercadopago"] as const;
    return [
      store.payment_settings.cash_enabled ? ("cash" as const) : null,
      hasMercadoPago(store.payment_settings) ? ("mercadopago" as const) : null
    ].filter(Boolean) as Array<"cash" | "mercadopago">;
  }, [store]);
  const selectedAddress = useMemo(
    () => addresses.find((address) => address.id === selectedAddressId) ?? null,
    [addresses, selectedAddressId]
  );

  useEffect(() => {
    if (availableMethods.length && !availableMethods.includes(paymentMethod)) {
      setPaymentMethod(availableMethods[0]);
    }
  }, [availableMethods, paymentMethod]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !checkoutCart?.store_id) return;
    if (checkoutCart.delivery_mode === "delivery" && !selectedAddressId) {
      setError("Seleccioná una direccion para el envio");
      return;
    }
    if (
      checkoutCart.delivery_mode === "delivery" &&
      (!selectedAddress || selectedAddress.latitude === null || selectedAddress.longitude === null)
    ) {
      setError("La direccion elegida necesita coordenadas para el tracking del delivery");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await checkout(token, {
        store_id: checkoutCart.store_id,
        address_id: checkoutCart.delivery_mode === "delivery" ? Number(selectedAddressId) : null,
        delivery_mode: checkoutCart.delivery_mode,
        payment_method: paymentMethod
      });
      if (result.checkout_url) {
        const path = normalizePath(result.checkout_url);
        if (path.startsWith("/")) {
          navigate(path);
        } else {
          setRedirectingToPayment(true);
          window.location.assign(result.checkout_url);
        }
        return;
      }
      navigate(`/orders/${result.order_id}`, { replace: true });
    } catch (err) {
      setRedirectingToPayment(false);
      setError(err instanceof Error ? err.message : "No se pudo completar el checkout");
    } finally {
      setSubmitting(false);
    }
  }

  if (!checkoutCart || !checkoutCart.items.length) {
    return (
      <EmptyCard
        title="No hay items para pagar"
        description="Primero agregá productos al carrito."
        action={
          <Link className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white" to="/">
            Volver al inicio
          </Link>
        }
      />
    );
  }

  if (loading) return <LoadingCard />;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Checkout" title="Confirmar pedido" description="Selecciona direccion, metodo de pago y confirma desde el backend." />
      <form onSubmit={(event) => void handleSubmit(event)} className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <div className="rounded-[28px] bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold">Entrega</h3>
            <p className="mt-1 text-sm text-zinc-500">{checkoutCart.delivery_mode === "delivery" ? "Envio a domicilio" : "Retiro en local"}</p>
            {checkoutCart.delivery_mode === "delivery" ? (
              <div className="mt-4 space-y-3">
                {addresses.length ? (
                  addresses.map((address) => (
                    <label key={address.id} className="flex items-start gap-3 rounded-2xl border border-black/5 p-4">
                      <input type="radio" checked={selectedAddressId === address.id} onChange={() => setSelectedAddressId(address.id)} className="mt-1" />
                      <div>
                        <p className="font-semibold">{address.label}</p>
                        <p className="text-sm text-zinc-600">{address.street}</p>
                        <p className="text-sm text-zinc-500">{address.details}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-400">
                          {address.latitude !== null && address.longitude !== null ? "Con pin de mapa" : "Falta pin de mapa"}
                        </p>
                      </div>
                    </label>
                  ))
                ) : (
                  <EmptyCard
                    title="No tenes direcciones"
                    description="Creá una dirección para recibir el pedido."
                    action={
                      <Link className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white" to="/addresses">
                        Mis direcciones
                      </Link>
                    }
                  />
                )}
              </div>
            ) : null}
          </div>

          <div className="rounded-[28px] bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold">Pago</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {availableMethods.map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    paymentMethod === method ? "bg-brand-500 text-white" : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  {paymentMethodLabels[method]}
                </button>
              ))}
            </div>
            {paymentMethod === "mercadopago" ? <p className="mt-3 text-sm text-zinc-500">Seras redirigido a Mercado Pago para terminar el pago.</p> : null}
            {!availableMethods.length ? <p className="mt-3 text-sm text-rose-700">Este comercio no tiene medios de pago habilitados.</p> : null}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-[28px] bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold">Pedido</h3>
            <div className="mt-4 space-y-3 text-sm text-zinc-600">
              {checkoutCart.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3">
                  <span>
                    {item.product_name} x {item.quantity}
                  </span>
                  <span>{formatCurrency(item.unit_price * item.quantity)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-black/5 pt-3">
                <span>Subtotal</span>
                <span>{formatCurrency(checkoutCart.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Envio</span>
                <span>{formatCurrency(checkoutCart.delivery_fee)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Servicio</span>
                <span>{formatCurrency(checkoutCart.service_fee)}</span>
              </div>
              <div className="flex items-center justify-between text-base font-bold text-ink">
                <span>Total</span>
                <span>{formatCurrency(checkoutCart.total)}</span>
              </div>
            </div>
            {error ? <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
            <button type="submit" disabled={submitting || redirectingToPayment || !availableMethods.length} className="mt-4 w-full rounded-full bg-brand-500 px-4 py-3 text-sm font-semibold text-white disabled:bg-zinc-300">
              {redirectingToPayment ? "Redirigiendo a Mercado Pago..." : submitting ? "Procesando..." : "Confirmar pedido"}
            </button>
            {checkoutCart.delivery_mode === "delivery" && selectedAddress && (selectedAddress.latitude === null || selectedAddress.longitude === null) ? (
              <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Esa direccion no tiene coordenadas. Editala antes de pedir tracking en vivo.
              </p>
            ) : null}
          </div>
        </aside>
      </form>
    </div>
  );
}
