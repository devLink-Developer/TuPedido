import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  createMerchantProduct,
  createMerchantSettlementNotice,
  deleteMerchantProduct,
  fetchCategories,
  fetchMerchantMercadoPagoConnectUrl,
  fetchMerchantOrders,
  fetchMerchantProductCategories,
  fetchMerchantProducts,
  fetchMerchantSettlementCharges,
  fetchMerchantSettlementNotices,
  fetchMerchantSettlementOverview,
  fetchMerchantStore,
  updateMerchantDeliverySettings,
  updateMerchantOrderStatus,
  updateMerchantPaymentSettings,
  updateMerchantProduct,
  updateMerchantStore,
  updateMerchantStoreCategories,
  updateMerchantStoreHours
} from "../api";
import { useSession } from "../session";
import type {
  Category,
  MerchantOrder,
  MerchantStore,
  Product,
  ProductCategory,
  SettlementCharge,
  SettlementNotice,
  SettlementOverview,
  StoreHourWrite
} from "../types";
import { EmptyCard, LoadingCard, PageHeader, formatCurrency, formatHour, orderStatusOptions, paymentMethodLabels, statusLabels, timeFromInput } from "./common";

type TabKey = "overview" | "store" | "orders" | "products" | "payments";

const emptyStoreForm = {
  name: "",
  description: "",
  address: "",
  phone: "",
  latitude: "",
  longitude: "",
  logo_url: "",
  cover_image_url: "",
  accepting_orders: true,
  opening_note: "",
  min_delivery_minutes: 20,
  max_delivery_minutes: 45
};

function parseNullableNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function makeEmptyHours(): StoreHourWrite[] {
  return Array.from({ length: 7 }, (_, day_of_week) => ({ day_of_week, opens_at: "09:00:00", closes_at: "18:00:00", is_closed: false }));
}

export function MerchantDashboardPage() {
  const { token } = useSession();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [store, setStore] = useState<MerchantStore | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [productCategories, setProductCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<MerchantOrder[]>([]);
  const [overview, setOverview] = useState<SettlementOverview | null>(null);
  const [charges, setCharges] = useState<SettlementCharge[]>([]);
  const [notices, setNotices] = useState<SettlementNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [storeForm, setStoreForm] = useState(emptyStoreForm);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [hours, setHours] = useState<StoreHourWrite[]>(makeEmptyHours());
  const [deliveryForm, setDeliveryForm] = useState({ delivery_enabled: true, pickup_enabled: true, delivery_fee: 0, min_order: 0 });
  const [paymentForm, setPaymentForm] = useState({ cash_enabled: true, mercadopago_enabled: true });
  const [connectUrl, setConnectUrl] = useState<string | null>(null);
  const [connectStatus, setConnectStatus] = useState<string | null>(null);
  const [noticeForm, setNoticeForm] = useState({ amount: 0, transfer_date: "", bank: "", reference: "", notes: "" });
  const [productForm, setProductForm] = useState({ name: "", description: "", price: 0, compare_at_price: "", image_url: "", product_category_id: "", is_available: true, sort_order: 0 });
  const [editingProductId, setEditingProductId] = useState<number | null>(null);

  async function load() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [storeData, categoryData, productCategoryData, productData, orderData, overviewData, chargeData, noticeData] = await Promise.all([
        fetchMerchantStore(token),
        fetchCategories(),
        fetchMerchantProductCategories(token),
        fetchMerchantProducts(token),
        fetchMerchantOrders(token),
        fetchMerchantSettlementOverview(token),
        fetchMerchantSettlementCharges(token),
        fetchMerchantSettlementNotices(token)
      ]);
      setStore(storeData);
      setCategories(categoryData);
      setProductCategories(productCategoryData);
      setProducts(productData);
      setOrders(orderData);
      setOverview(overviewData);
      setCharges(chargeData);
      setNotices(noticeData);
      setStoreForm({
        name: storeData.name,
        description: storeData.description,
        address: storeData.address,
        phone: storeData.phone,
        latitude: storeData.latitude?.toString() ?? "",
        longitude: storeData.longitude?.toString() ?? "",
        logo_url: storeData.logo_url ?? "",
        cover_image_url: storeData.cover_image_url ?? "",
        accepting_orders: storeData.accepting_orders,
        opening_note: storeData.opening_note ?? "",
        min_delivery_minutes: storeData.min_delivery_minutes,
        max_delivery_minutes: storeData.max_delivery_minutes
      });
      setSelectedCategoryIds(storeData.category_ids ?? []);
      setHours(storeData.hours?.length ? storeData.hours : makeEmptyHours());
      setDeliveryForm({
        delivery_enabled: storeData.delivery_settings.delivery_enabled,
        pickup_enabled: storeData.delivery_settings.pickup_enabled,
        delivery_fee: storeData.delivery_settings.delivery_fee,
        min_order: storeData.delivery_settings.min_order
      });
      setPaymentForm({
        cash_enabled: storeData.payment_settings.cash_enabled,
        mercadopago_enabled: storeData.payment_settings.mercadopago_enabled
      });
      setConnectStatus(storeData.payment_settings.mercadopago_connection_status ?? (storeData.payment_settings.mercadopago_reconnect_required ? "reconnect_required" : null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el panel");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  const tabs = useMemo(
    () => [
      ["overview", "Resumen"],
      ["store", "Tienda"],
      ["orders", "Pedidos"],
      ["products", "Productos"],
      ["payments", "Cobros"]
    ] as const,
    []
  );

  async function saveStore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await updateMerchantStore(token, {
        ...storeForm,
        latitude: storeForm.latitude ? Number(storeForm.latitude) : null,
        longitude: storeForm.longitude ? Number(storeForm.longitude) : null,
        logo_url: storeForm.logo_url || null,
        cover_image_url: storeForm.cover_image_url || null
      });
      await updateMerchantStoreCategories(token, { category_ids: selectedCategoryIds });
      await updateMerchantStoreHours(token, { hours });
      await updateMerchantDeliverySettings(token, deliveryForm);
      await updateMerchantPaymentSettings(token, paymentForm);
      setSuccess("Configuracion guardada");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la tienda");
    } finally {
      setSaving(false);
    }
  }

  async function connectMercadoPago() {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetchMerchantMercadoPagoConnectUrl(token);
      setConnectUrl(response.connect_url);
      setConnectStatus(response.status ?? null);
      if (response.connect_url) window.location.assign(response.connect_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo obtener el enlace de conexion");
    } finally {
      setSaving(false);
    }
  }

  async function saveNotice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await createMerchantSettlementNotice(token, {
        amount: noticeForm.amount,
        transfer_date: noticeForm.transfer_date,
        bank: noticeForm.bank,
        reference: noticeForm.reference,
        notes: noticeForm.notes || null
      });
      setNoticeForm({ amount: 0, transfer_date: "", bank: "", reference: "", notes: "" });
      setSuccess("Notificacion enviada");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar la transferencia");
    } finally {
      setSaving(false);
    }
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: productForm.name,
        description: productForm.description,
        price: productForm.price,
        compare_at_price: productForm.compare_at_price ? Number(productForm.compare_at_price) : null,
        image_url: productForm.image_url || null,
        product_category_id: productForm.product_category_id ? Number(productForm.product_category_id) : null,
        is_available: productForm.is_available,
        sort_order: productForm.sort_order
      };
      if (editingProductId) {
        await updateMerchantProduct(token, editingProductId, payload);
      } else {
        await createMerchantProduct(token, payload);
      }
      setEditingProductId(null);
      setProductForm({ name: "", description: "", price: 0, compare_at_price: "", image_url: "", product_category_id: "", is_available: true, sort_order: 0 });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el producto");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingCard />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Comercio"
        title={store?.name ?? "Panel de comercio"}
        description="Gestiona tu tienda, pedidos, pagos y la cuenta corriente del servicio cobrado al comprador."
      />

      {error ? <EmptyCard title="Error" description={error} /> : null}
      {success ? <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{success}</div> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-[28px] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Saldo pendiente</p>
          <p className="mt-3 font-display text-3xl font-bold tracking-tight text-ink">{formatCurrency(overview?.pending_balance ?? 0)}</p>
          <p className="mt-2 text-sm text-zinc-600">{overview?.pending_charges_count ?? 0} cargos abiertos</p>
        </article>
        <article className="rounded-[28px] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Neto comercio</p>
          <p className="mt-3 font-display text-3xl font-bold tracking-tight text-ink">{formatCurrency(Math.max((overview?.pending_balance ?? 0) - (store?.delivery_settings.delivery_fee ?? 0), 0))}</p>
          <p className="mt-2 text-sm text-zinc-600">Los pedidos muestran total cliente y neto sin el servicio.</p>
        </article>
        <article className="rounded-[28px] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Mercado Pago</p>
          <p className="mt-3 font-display text-2xl font-bold tracking-tight text-ink">{connectStatus ?? store?.payment_settings.mercadopago_connection_status ?? "sin conectar"}</p>
          <button type="button" onClick={() => void connectMercadoPago()} className="mt-4 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white" disabled={saving}>
            Conectar Mercado Pago
          </button>
        </article>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activeTab === key ? "bg-brand-500 text-white" : "bg-white text-zinc-600 shadow-sm"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "overview" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-[28px] bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold">Cuenta corriente</h3>
            <p className="mt-2 text-sm text-zinc-600">Servicio cobrado al comprador, liquidaciones pendientes y cargos por pedidos cash entregados.</p>
            <div className="mt-4 space-y-2 text-sm">
              <p>Comercio: {store?.name ?? "-"}</p>
              <p>Saldo pendiente: {formatCurrency(overview?.pending_balance ?? 0)}</p>
              <p>Pagado: {formatCurrency(overview?.paid_balance ?? 0)}</p>
              <p>Cargos: {overview?.pending_charges_count ?? 0}</p>
              <p>Notices: {overview?.pending_notices_count ?? 0}</p>
            </div>
          </article>
          <article className="rounded-[28px] bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold">Movimientos recientes</h3>
            <div className="mt-4 space-y-3">
              {charges.slice(0, 4).map((charge) => (
                <div key={charge.id} className="rounded-2xl bg-zinc-50 p-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span>Pedido #{charge.order_id}</span>
                    <strong>{formatCurrency(charge.service_fee)}</strong>
                  </div>
                  <div className="mt-1 text-zinc-500">
                    {paymentMethodLabels[charge.payment_method]} | {statusLabels[charge.status] ?? charge.status}
                  </div>
                </div>
              ))}
              {!charges.length ? <p className="text-sm text-zinc-500">Sin cargos cargados aun.</p> : null}
            </div>
          </article>
        </div>
      ) : null}

      {activeTab === "store" ? (
        <form onSubmit={(event) => void saveStore(event)} className="space-y-4 rounded-[28px] bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold">Datos del comercio</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {[
              ["name", "Nombre"],
              ["phone", "Telefono"],
              ["address", "Direccion"],
              ["logo_url", "Logo URL"],
              ["cover_image_url", "Portada URL"]
            ].map(([key, label]) => (
            <label key={key} className="space-y-2 text-sm font-semibold text-zinc-700">
                <span>{label}</span>
                <input
                  value={(storeForm as Record<string, string | boolean | number>)[key] as string}
                  onChange={(event) => setStoreForm((current) => ({ ...current, [key]: event.target.value }))}
                  className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
                />
              </label>
            ))}
            <label className="space-y-2 text-sm font-semibold text-zinc-700">
              <span>Latitud</span>
              <input
                value={storeForm.latitude}
                onChange={(event) => setStoreForm((current) => ({ ...current, latitude: event.target.value }))}
                className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
                placeholder="-34.56"
              />
            </label>
            <label className="space-y-2 text-sm font-semibold text-zinc-700">
              <span>Longitud</span>
              <input
                value={storeForm.longitude}
                onChange={(event) => setStoreForm((current) => ({ ...current, longitude: event.target.value }))}
                className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
                placeholder="-58.45"
              />
            </label>
          </div>
          <label className="space-y-2 text-sm font-semibold text-zinc-700">
            <span>Descripcion</span>
            <textarea value={storeForm.description} onChange={(event) => setStoreForm((current) => ({ ...current, description: event.target.value }))} rows={4} className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
          </label>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-2 text-sm font-semibold text-zinc-700">
              <span>Minutos minimos</span>
              <input type="number" value={storeForm.min_delivery_minutes} onChange={(event) => setStoreForm((current) => ({ ...current, min_delivery_minutes: parseNullableNumber(event.target.value) }))} className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
            </label>
            <label className="space-y-2 text-sm font-semibold text-zinc-700">
              <span>Minutos maximos</span>
              <input type="number" value={storeForm.max_delivery_minutes} onChange={(event) => setStoreForm((current) => ({ ...current, max_delivery_minutes: parseNullableNumber(event.target.value) }))} className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
            </label>
            <label className="flex items-center gap-2 rounded-2xl bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700">
              <input type="checkbox" checked={storeForm.accepting_orders} onChange={(event) => setStoreForm((current) => ({ ...current, accepting_orders: event.target.checked }))} />
              Recibir pedidos
            </label>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold">Categorias</h4>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setSelectedCategoryIds((current) => current.includes(category.id) ? current.filter((id) => id !== category.id) : [...current, category.id])}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${selectedCategoryIds.includes(category.id) ? "bg-brand-500 text-white" : "bg-zinc-100 text-zinc-700"}`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold">Horario</h4>
            <div className="grid gap-3 md:grid-cols-2">
              {hours.map((hour, index) => (
                <div key={hour.day_of_week} className="rounded-2xl bg-zinc-50 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-semibold">{["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"][hour.day_of_week]}</span>
                    <label className="flex items-center gap-2 text-xs font-semibold">
                      <input type="checkbox" checked={hour.is_closed} onChange={(event) => setHours((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, is_closed: event.target.checked } : item))} />
                      Cerrado
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={formatHour(hour.opens_at)} onChange={(event) => setHours((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, opens_at: timeFromInput(event.target.value) } : item))} className="rounded-xl border border-black/10 bg-white px-3 py-2" />
                    <input value={formatHour(hour.closes_at)} onChange={(event) => setHours((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, closes_at: timeFromInput(event.target.value) } : item))} className="rounded-xl border border-black/10 bg-white px-3 py-2" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-2 rounded-2xl bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700">
              <input type="checkbox" checked={deliveryForm.delivery_enabled} onChange={(event) => setDeliveryForm((current) => ({ ...current, delivery_enabled: event.target.checked }))} />
              Delivery
            </label>
            <label className="flex items-center gap-2 rounded-2xl bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700">
              <input type="checkbox" checked={deliveryForm.pickup_enabled} onChange={(event) => setDeliveryForm((current) => ({ ...current, pickup_enabled: event.target.checked }))} />
              Retiro
            </label>
            <input type="number" value={deliveryForm.delivery_fee} onChange={(event) => setDeliveryForm((current) => ({ ...current, delivery_fee: parseNullableNumber(event.target.value) }))} placeholder="Costo de envio" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
            <input type="number" value={deliveryForm.min_order} onChange={(event) => setDeliveryForm((current) => ({ ...current, min_order: parseNullableNumber(event.target.value) }))} placeholder="Pedido minimo" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-2 rounded-2xl bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700">
              <input type="checkbox" checked={paymentForm.cash_enabled} onChange={(event) => setPaymentForm((current) => ({ ...current, cash_enabled: event.target.checked }))} />
              Efectivo
            </label>
            <label className="flex items-center gap-2 rounded-2xl bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700">
              <input type="checkbox" checked={paymentForm.mercadopago_enabled} onChange={(event) => setPaymentForm((current) => ({ ...current, mercadopago_enabled: event.target.checked }))} />
              Mercado Pago
            </label>
          </div>

          <button type="submit" disabled={saving} className="rounded-full bg-brand-500 px-5 py-3 text-sm font-semibold text-white disabled:bg-zinc-300">
            Guardar cambios
          </button>
        </form>
      ) : null}

      {activeTab === "orders" ? (
        <div className="space-y-4">
          {orders.map((order) => (
            <article key={order.id} className="rounded-[28px] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">Pedido #{order.id}</h3>
                  <p className="text-sm text-zinc-600">{order.customer_name} | {order.store_name}</p>
                </div>
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">{statusLabels[order.status] ?? order.status}</span>
              </div>
              <div className="mt-3 grid gap-2 text-sm text-zinc-600 md:grid-cols-4">
                <p>Pago: {paymentMethodLabels[order.payment_method]}</p>
                <p>Total cliente: {formatCurrency(order.total)}</p>
                <p>Neto comercio: {formatCurrency(Math.max(order.total - order.service_fee - order.delivery_fee_customer, 0))}</p>
                <p>Servicio: {formatCurrency(order.service_fee)}</p>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-sm text-zinc-500">
                <span>Tracking: {statusLabels[order.delivery_status] ?? order.delivery_status}</span>
                {order.assigned_rider_name ? <span>Rider: {order.assigned_rider_name}</span> : null}
                {order.eta_minutes ? <span>ETA: {order.eta_minutes} min</span> : null}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {orderStatusOptions.map((status) => (
                  <button key={status} type="button" onClick={async () => { if (!token) return; await updateMerchantOrderStatus(token, order.id, { status }); await load(); }} className="rounded-full bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-700">
                    {statusLabels[status] ?? status}
                  </button>
                ))}
                <Link to={`/orders/${order.id}`} className="rounded-full bg-brand-500 px-3 py-2 text-xs font-semibold text-white">
                  Ver tracking
                </Link>
              </div>
            </article>
          ))}
          {!orders.length ? <EmptyCard title="Sin pedidos" description="Los pedidos del comercio apareceran aqui." /> : null}
        </div>
      ) : null}

      {activeTab === "products" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <form onSubmit={(event) => void saveProduct(event)} className="space-y-4 rounded-[28px] bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold">{editingProductId ? "Editar producto" : "Nuevo producto"}</h3>
            <input value={productForm.name} onChange={(event) => setProductForm((current) => ({ ...current, name: event.target.value }))} placeholder="Nombre" className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
            <textarea value={productForm.description} onChange={(event) => setProductForm((current) => ({ ...current, description: event.target.value }))} rows={4} placeholder="Descripcion" className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
            <div className="grid gap-3 md:grid-cols-2">
              <input type="number" value={productForm.price} onChange={(event) => setProductForm((current) => ({ ...current, price: parseNullableNumber(event.target.value) }))} placeholder="Precio" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
              <input type="number" value={productForm.compare_at_price} onChange={(event) => setProductForm((current) => ({ ...current, compare_at_price: event.target.value }))} placeholder="Precio anterior" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
              <input value={productForm.image_url} onChange={(event) => setProductForm((current) => ({ ...current, image_url: event.target.value }))} placeholder="Imagen URL" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
              <input type="number" value={productForm.sort_order} onChange={(event) => setProductForm((current) => ({ ...current, sort_order: parseNullableNumber(event.target.value) }))} placeholder="Orden" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
            </div>
            <select value={productForm.product_category_id} onChange={(event) => setProductForm((current) => ({ ...current, product_category_id: event.target.value }))} className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3">
              <option value="">Sin categoria</option>
              {productCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm font-semibold text-zinc-700">
              <input type="checkbox" checked={productForm.is_available} onChange={(event) => setProductForm((current) => ({ ...current, is_available: event.target.checked }))} />
              Disponible
            </label>
            <button type="submit" disabled={saving} className="rounded-full bg-brand-500 px-5 py-3 text-sm font-semibold text-white disabled:bg-zinc-300">
              {editingProductId ? "Actualizar" : "Crear"}
            </button>
          </form>
          <div className="space-y-3">
            {products.map((product) => (
              <article key={product.id} className="rounded-[28px] bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold">{product.name}</h4>
                    <p className="text-sm text-zinc-600">{formatCurrency(product.price)} | {product.product_category_name ?? "Sin categoria"}</p>
                  </div>
                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">{product.is_available ? "Activo" : "Pausado"}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => { setEditingProductId(product.id); setProductForm({ name: product.name, description: product.description, price: product.price, compare_at_price: product.compare_at_price?.toString() ?? "", image_url: product.image_url ?? "", product_category_id: product.product_category_id?.toString() ?? "", is_available: product.is_available, sort_order: product.sort_order }); }} className="rounded-full bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-700">
                    Editar
                  </button>
                  <button type="button" onClick={async () => { if (!token) return; await deleteMerchantProduct(token, product.id); await load(); }} className="rounded-full bg-rose-500 px-3 py-2 text-xs font-semibold text-white">
                    Eliminar
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {activeTab === "payments" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <form onSubmit={(event) => void saveNotice(event)} className="space-y-4 rounded-[28px] bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold">Avisar transferencia</h3>
            <input type="number" value={noticeForm.amount} onChange={(event) => setNoticeForm((current) => ({ ...current, amount: parseNullableNumber(event.target.value) }))} placeholder="Monto" className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
            <input type="date" value={noticeForm.transfer_date} onChange={(event) => setNoticeForm((current) => ({ ...current, transfer_date: event.target.value }))} className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
            <input value={noticeForm.bank} onChange={(event) => setNoticeForm((current) => ({ ...current, bank: event.target.value }))} placeholder="Banco" className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
            <input value={noticeForm.reference} onChange={(event) => setNoticeForm((current) => ({ ...current, reference: event.target.value }))} placeholder="Referencia" className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
            <textarea value={noticeForm.notes} onChange={(event) => setNoticeForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Notas" rows={4} className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
            <button type="submit" disabled={saving} className="rounded-full bg-brand-500 px-5 py-3 text-sm font-semibold text-white disabled:bg-zinc-300">
              Enviar aviso
            </button>
          </form>
          <div className="space-y-4">
            <article className="rounded-[28px] bg-white p-5 shadow-sm">
              <h3 className="text-lg font-bold">Notices y pagos</h3>
              <div className="mt-4 space-y-3">
                {notices.map((notice) => (
                  <div key={notice.id} className="rounded-2xl bg-zinc-50 p-4 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span>{notice.bank}</span>
                      <strong>{formatCurrency(notice.amount)}</strong>
                    </div>
                    <p className="mt-1 text-zinc-500">{notice.reference} | {statusLabels[notice.status] ?? notice.status}</p>
                  </div>
                ))}
                {!notices.length ? <p className="text-sm text-zinc-500">Sin avisos de transferencia.</p> : null}
              </div>
            </article>
          </div>
        </div>
      ) : null}

      {connectUrl ? (
        <p className="text-xs text-zinc-500">Conexion lista: {connectUrl}</p>
      ) : null}
    </div>
  );
}
