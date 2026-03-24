import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  assignAdminDeliveryOrder,
  createAdminDeliverySettlementPayment,
  createAdminDeliveryZone,
  createAdminCategory,
  createAdminSettlementPayment,
  fetchAdminDeliveryApplications,
  fetchAdminDeliveryDispatch,
  fetchAdminDeliveryRiders,
  fetchAdminDeliverySettlements,
  fetchAdminDeliveryZones,
  fetchAdminApplications,
  fetchAdminCategories,
  fetchAdminOrders,
  fetchAdminSettlementNotices,
  fetchAdminSettlementPayments,
  fetchAdminSettlementStores,
  fetchAdminStores,
  fetchPlatformSettings,
  reviewAdminDeliveryApplication,
  reviewAdminSettlementNotice,
  reviewMerchantApplication,
  updateAdminDeliveryZone,
  updateAdminStoreStatus,
  updatePlatformSettings
} from "../api";
import { useSession } from "../session";
import type {
  AdminSettlementStore,
  Category,
  DeliveryApplication,
  DeliveryProfile,
  DeliverySettlement,
  DeliveryZone,
  MerchantApplication,
  Order,
  PlatformSettings,
  SettlementNotice,
  SettlementPayment,
  StoreSummary
} from "../types";
import { EmptyCard, LoadingCard, PageHeader, formatCurrency, paymentMethodLabels, statusLabels } from "./common";

type TabKey = "categories" | "applications" | "stores" | "orders" | "settings" | "settlements" | "delivery";

export function AdminDashboardPage() {
  const { token } = useSession();
  const [activeTab, setActiveTab] = useState<TabKey>("applications");
  const [categories, setCategories] = useState<Category[]>([]);
  const [applications, setApplications] = useState<MerchantApplication[]>([]);
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveryApplications, setDeliveryApplications] = useState<DeliveryApplication[]>([]);
  const [riders, setRiders] = useState<DeliveryProfile[]>([]);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [deliveryDispatch, setDeliveryDispatch] = useState<Order[]>([]);
  const [deliverySettlements, setDeliverySettlements] = useState<DeliverySettlement[]>([]);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null);
  const [settlementStores, setSettlementStores] = useState<AdminSettlementStore[]>([]);
  const [settlementNotices, setSettlementNotices] = useState<SettlementNotice[]>([]);
  const [settlementPayments, setSettlementPayments] = useState<SettlementPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});
  const [serviceFee, setServiceFee] = useState("350");
  const [paymentForm, setPaymentForm] = useState({ store_id: "", amount: "", reference: "", notes: "" });
  const [noticeNotes, setNoticeNotes] = useState<Record<number, string>>({});
  const [deliveryPaymentForm, setDeliveryPaymentForm] = useState({ rider_user_id: "", amount: "", reference: "", notes: "" });
  const [zoneForm, setZoneForm] = useState({
    id: "",
    name: "",
    description: "",
    center_latitude: "",
    center_longitude: "",
    radius_km: "5",
    is_active: true,
    bicycle_delivery_fee_customer: "250",
    bicycle_rider_fee: "160",
    motorcycle_delivery_fee_customer: "350",
    motorcycle_rider_fee: "220",
    car_delivery_fee_customer: "480",
    car_rider_fee: "310"
  });

  async function load() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [
        categoryData,
        applicationData,
        storeData,
        orderData,
        platformData,
        settlementStoreData,
        settlementNoticeData,
        settlementPaymentData,
        deliveryApplicationData,
        riderData,
        deliveryZoneData,
        deliveryDispatchData,
        deliverySettlementData
      ] = await Promise.all([
        fetchAdminCategories(token),
        fetchAdminApplications(token),
        fetchAdminStores(token),
        fetchAdminOrders(token),
        fetchPlatformSettings(token),
        fetchAdminSettlementStores(token),
        fetchAdminSettlementNotices(token),
        fetchAdminSettlementPayments(token),
        fetchAdminDeliveryApplications(token),
        fetchAdminDeliveryRiders(token),
        fetchAdminDeliveryZones(token),
        fetchAdminDeliveryDispatch(token),
        fetchAdminDeliverySettlements(token)
      ]);
      setCategories(categoryData);
      setApplications(applicationData);
      setStores(storeData);
      setOrders(orderData);
      setDeliveryApplications(deliveryApplicationData);
      setRiders(riderData);
      setDeliveryZones(deliveryZoneData);
      setDeliveryDispatch(deliveryDispatchData);
      setDeliverySettlements(deliverySettlementData);
      setPlatformSettings(platformData);
      setServiceFee(platformData.service_fee_amount.toFixed(2));
      setSettlementStores(settlementStoreData);
      setSettlementNotices(settlementNoticeData);
      setSettlementPayments(settlementPaymentData);
      if (!paymentForm.store_id && settlementStoreData[0]) {
        setPaymentForm((current) => ({ ...current, store_id: String(settlementStoreData[0].id) }));
      }
      if (!deliveryPaymentForm.rider_user_id && deliverySettlementData[0]) {
        setDeliveryPaymentForm((current) => ({ ...current, rider_user_id: String(deliverySettlementData[0].rider_user_id) }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el panel admin");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  const tabs = useMemo(
    () =>
      [
        ["applications", "Aplicaciones"],
        ["stores", "Comercios"],
        ["categories", "Categorias"],
        ["orders", "Pedidos"],
        ["delivery", "Delivery"],
        ["settings", "Servicio"],
        ["settlements", "Cobranzas"]
      ] as const,
    []
  );

  async function handleCategoryCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await createAdminCategory(token, { name: categoryName, description: categoryDescription || null });
      setCategoryName("");
      setCategoryDescription("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la categoria");
    } finally {
      setSaving(false);
    }
  }

  async function handleReview(applicationId: number, status: "approved" | "rejected" | "suspended") {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await reviewMerchantApplication(token, applicationId, { status, review_notes: reviewNotes[applicationId] ?? null });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo revisar la aplicacion");
    } finally {
      setSaving(false);
    }
  }

  async function handleStoreStatus(storeId: number, status: "approved" | "rejected" | "suspended") {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await updateAdminStoreStatus(token, storeId, { status });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el comercio");
    } finally {
      setSaving(false);
    }
  }

  async function savePlatformSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await updatePlatformSettings(token, { service_fee_amount: Number(serviceFee) || 0 });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el servicio global");
    } finally {
      setSaving(false);
    }
  }

  async function saveSettlementPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await createAdminSettlementPayment(token, {
        store_id: Number(paymentForm.store_id),
        amount: Number(paymentForm.amount),
        reference: paymentForm.reference || null,
        notes: paymentForm.notes || null
      });
      setPaymentForm((current) => ({ ...current, amount: "", reference: "", notes: "" }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el pago");
    } finally {
      setSaving(false);
    }
  }

  async function reviewNotice(id: number, status: "approved" | "rejected" | "pending") {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await reviewAdminSettlementNotice(token, id, { status, review_notes: noticeNotes[id] ?? null });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo revisar el aviso");
    } finally {
      setSaving(false);
    }
  }

  async function reviewDeliveryApplication(applicationId: number, status: "pending_review" | "approved" | "rejected" | "suspended") {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await reviewAdminDeliveryApplication(token, applicationId, {
        status,
        review_notes: reviewNotes[applicationId] ?? null
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo revisar la solicitud delivery");
    } finally {
      setSaving(false);
    }
  }

  async function saveDeliveryZone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: zoneForm.name,
        description: zoneForm.description || null,
        center_latitude: Number(zoneForm.center_latitude),
        center_longitude: Number(zoneForm.center_longitude),
        radius_km: Number(zoneForm.radius_km),
        is_active: zoneForm.is_active,
        rates: [
          {
            vehicle_type: "bicycle" as const,
            delivery_fee_customer: Number(zoneForm.bicycle_delivery_fee_customer),
            rider_fee: Number(zoneForm.bicycle_rider_fee)
          },
          {
            vehicle_type: "motorcycle" as const,
            delivery_fee_customer: Number(zoneForm.motorcycle_delivery_fee_customer),
            rider_fee: Number(zoneForm.motorcycle_rider_fee)
          },
          {
            vehicle_type: "car" as const,
            delivery_fee_customer: Number(zoneForm.car_delivery_fee_customer),
            rider_fee: Number(zoneForm.car_rider_fee)
          }
        ]
      };
      if (zoneForm.id) {
        await updateAdminDeliveryZone(token, Number(zoneForm.id), payload);
      } else {
        await createAdminDeliveryZone(token, payload);
      }
      setZoneForm({
        id: "",
        name: "",
        description: "",
        center_latitude: "",
        center_longitude: "",
        radius_km: "5",
        is_active: true,
        bicycle_delivery_fee_customer: "250",
        bicycle_rider_fee: "160",
        motorcycle_delivery_fee_customer: "350",
        motorcycle_rider_fee: "220",
        car_delivery_fee_customer: "480",
        car_rider_fee: "310"
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la zona");
    } finally {
      setSaving(false);
    }
  }

  async function assignDispatchOrder(orderId: number, riderUserId: number) {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await assignAdminDeliveryOrder(token, orderId, riderUserId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo asignar el pedido");
    } finally {
      setSaving(false);
    }
  }

  async function saveDeliveryPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await createAdminDeliverySettlementPayment(token, {
        rider_user_id: Number(deliveryPaymentForm.rider_user_id),
        amount: Number(deliveryPaymentForm.amount),
        paid_at: new Date().toISOString(),
        reference: deliveryPaymentForm.reference || null,
        notes: deliveryPaymentForm.notes || null
      });
      setDeliveryPaymentForm((current) => ({ ...current, amount: "", reference: "", notes: "" }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar la liquidación rider");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingCard />;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Admin" title="Panel de administracion" description="Aprobaciones, catalogos, servicio global y cobranzas del sistema." />
      {error ? <EmptyCard title="Error" description={error} /> : null}

      <div className="flex flex-wrap gap-2">
        {tabs.map(([key, label]) => (
          <button key={key} type="button" onClick={() => setActiveTab(key)} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activeTab === key ? "bg-brand-500 text-white" : "bg-white text-zinc-600 shadow-sm"}`}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === "delivery" ? (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-[28px] bg-white p-5 shadow-sm">
              <h3 className="text-lg font-bold">Solicitudes de repartidores</h3>
              <div className="mt-4 space-y-3">
                {deliveryApplications.map((application) => (
                  <div key={application.id} className="rounded-2xl bg-zinc-50 p-4 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <strong>{application.user_name}</strong>
                        <p className="mt-1 text-zinc-500">{application.vehicle_type} · {application.phone}</p>
                      </div>
                      <span>{statusLabels[application.status] ?? application.status}</span>
                    </div>
                    <textarea
                      value={reviewNotes[application.id] ?? application.review_notes ?? ""}
                      onChange={(event) => setReviewNotes((current) => ({ ...current, [application.id]: event.target.value }))}
                      className="mt-3 w-full rounded-2xl border border-black/10 bg-white px-3 py-2"
                      rows={3}
                      placeholder="Notas de revisión"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(["approved", "rejected", "suspended"] as const).map((status) => (
                        <button key={status} type="button" onClick={() => void reviewDeliveryApplication(application.id, status)} className="rounded-full bg-zinc-900 px-3 py-2 text-xs font-semibold text-white">
                          {statusLabels[status] ?? status}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {!deliveryApplications.length ? <p className="text-sm text-zinc-500">Sin solicitudes delivery.</p> : null}
              </div>
            </article>

            <article className="rounded-[28px] bg-white p-5 shadow-sm">
              <h3 className="text-lg font-bold">Riders activos</h3>
              <div className="mt-4 space-y-3">
                {riders.map((rider) => (
                  <div key={rider.user_id} className="rounded-2xl bg-zinc-50 p-4 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <strong>{rider.full_name}</strong>
                      <span>{rider.availability}</span>
                    </div>
                    <p className="mt-1 text-zinc-500">{rider.vehicle_type} · {rider.phone}</p>
                    <p className="mt-1 text-zinc-500">
                      Zona {rider.current_zone_id ?? "sin zona"} · {rider.completed_deliveries} entregas
                    </p>
                  </div>
                ))}
                {!riders.length ? <p className="text-sm text-zinc-500">Sin riders aprobados.</p> : null}
              </div>
            </article>
          </div>

          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <form onSubmit={(event) => void saveDeliveryZone(event)} className="rounded-[28px] bg-white p-5 shadow-sm">
              <h3 className="text-lg font-bold">Zonas y tarifas</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <input value={zoneForm.name} onChange={(event) => setZoneForm((current) => ({ ...current, name: event.target.value }))} placeholder="Nombre de zona" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
                <input value={zoneForm.radius_km} onChange={(event) => setZoneForm((current) => ({ ...current, radius_km: event.target.value }))} placeholder="Radio km" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
                <input value={zoneForm.center_latitude} onChange={(event) => setZoneForm((current) => ({ ...current, center_latitude: event.target.value }))} placeholder="Latitud" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
                <input value={zoneForm.center_longitude} onChange={(event) => setZoneForm((current) => ({ ...current, center_longitude: event.target.value }))} placeholder="Longitud" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
                <input value={zoneForm.bicycle_delivery_fee_customer} onChange={(event) => setZoneForm((current) => ({ ...current, bicycle_delivery_fee_customer: event.target.value }))} placeholder="Cliente bici" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
                <input value={zoneForm.bicycle_rider_fee} onChange={(event) => setZoneForm((current) => ({ ...current, bicycle_rider_fee: event.target.value }))} placeholder="Rider bici" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
                <input value={zoneForm.motorcycle_delivery_fee_customer} onChange={(event) => setZoneForm((current) => ({ ...current, motorcycle_delivery_fee_customer: event.target.value }))} placeholder="Cliente moto" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
                <input value={zoneForm.motorcycle_rider_fee} onChange={(event) => setZoneForm((current) => ({ ...current, motorcycle_rider_fee: event.target.value }))} placeholder="Rider moto" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
                <input value={zoneForm.car_delivery_fee_customer} onChange={(event) => setZoneForm((current) => ({ ...current, car_delivery_fee_customer: event.target.value }))} placeholder="Cliente auto" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
                <input value={zoneForm.car_rider_fee} onChange={(event) => setZoneForm((current) => ({ ...current, car_rider_fee: event.target.value }))} placeholder="Rider auto" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
              </div>
              <textarea value={zoneForm.description} onChange={(event) => setZoneForm((current) => ({ ...current, description: event.target.value }))} rows={3} placeholder="Descripción" className="mt-3 w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
              <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-zinc-700">
                <input type="checkbox" checked={zoneForm.is_active} onChange={(event) => setZoneForm((current) => ({ ...current, is_active: event.target.checked }))} />
                Zona activa
              </label>
              <button type="submit" disabled={saving} className="mt-4 rounded-full bg-brand-500 px-4 py-3 text-sm font-semibold text-white">
                Guardar zona
              </button>
            </form>

            <article className="rounded-[28px] bg-white p-5 shadow-sm">
              <h3 className="text-lg font-bold">Zonas cargadas</h3>
              <div className="mt-4 space-y-3">
                {deliveryZones.map((zone) => (
                  <button
                    key={zone.id}
                    type="button"
                    onClick={() =>
                      setZoneForm({
                        id: String(zone.id),
                        name: zone.name,
                        description: zone.description ?? "",
                        center_latitude: String(zone.center_latitude),
                        center_longitude: String(zone.center_longitude),
                        radius_km: String(zone.radius_km),
                        is_active: zone.is_active,
                        bicycle_delivery_fee_customer: String(zone.rates.find((rate) => rate.vehicle_type === "bicycle")?.delivery_fee_customer ?? 0),
                        bicycle_rider_fee: String(zone.rates.find((rate) => rate.vehicle_type === "bicycle")?.rider_fee ?? 0),
                        motorcycle_delivery_fee_customer: String(zone.rates.find((rate) => rate.vehicle_type === "motorcycle")?.delivery_fee_customer ?? 0),
                        motorcycle_rider_fee: String(zone.rates.find((rate) => rate.vehicle_type === "motorcycle")?.rider_fee ?? 0),
                        car_delivery_fee_customer: String(zone.rates.find((rate) => rate.vehicle_type === "car")?.delivery_fee_customer ?? 0),
                        car_rider_fee: String(zone.rates.find((rate) => rate.vehicle_type === "car")?.rider_fee ?? 0)
                      })
                    }
                    className="block w-full rounded-2xl bg-zinc-50 p-4 text-left text-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <strong>{zone.name}</strong>
                      <span>{zone.is_active ? "Activa" : "Pausada"}</span>
                    </div>
                    <p className="mt-1 text-zinc-500">{zone.description ?? "Sin descripción"} · {zone.radius_km} km</p>
                  </button>
                ))}
              </div>
            </article>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-[28px] bg-white p-5 shadow-sm">
              <h3 className="text-lg font-bold">Dispatch</h3>
              <div className="mt-4 space-y-3">
                {deliveryDispatch.map((order) => (
                  <div key={order.id} className="rounded-2xl bg-zinc-50 p-4 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <strong>Pedido #{order.id}</strong>
                      <span>{statusLabels[order.delivery_status] ?? order.delivery_status}</span>
                    </div>
                    <p className="mt-1 text-zinc-500">{order.store_name} · {order.customer_name}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {riders.map((rider) => (
                        <button key={rider.user_id} type="button" onClick={() => void assignDispatchOrder(order.id, rider.user_id)} className="rounded-full bg-zinc-900 px-3 py-2 text-xs font-semibold text-white">
                          {rider.full_name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <div className="space-y-4">
              <article className="rounded-[28px] bg-white p-5 shadow-sm">
                <h3 className="text-lg font-bold">Liquidación riders</h3>
                <div className="mt-4 space-y-3">
                  {deliverySettlements.map((item) => (
                    <div key={item.rider_user_id} className="rounded-2xl bg-zinc-50 p-4 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <strong>{item.rider_name}</strong>
                        <span>{item.vehicle_type}</span>
                      </div>
                      <p className="mt-1 text-zinc-500">Ganado {formatCurrency(item.rider_fee_earned_total)} · Cash {formatCurrency(item.cash_liability_total)}</p>
                    </div>
                  ))}
                </div>
              </article>

              <form onSubmit={(event) => void saveDeliveryPayment(event)} className="rounded-[28px] bg-white p-5 shadow-sm">
                <h3 className="text-lg font-bold">Registrar liquidación</h3>
                <div className="mt-4 grid gap-3">
                  <select value={deliveryPaymentForm.rider_user_id} onChange={(event) => setDeliveryPaymentForm((current) => ({ ...current, rider_user_id: event.target.value }))} className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3">
                    {deliverySettlements.map((item) => <option key={item.rider_user_id} value={item.rider_user_id}>{item.rider_name}</option>)}
                  </select>
                  <input type="number" min="0" step="0.01" value={deliveryPaymentForm.amount} onChange={(event) => setDeliveryPaymentForm((current) => ({ ...current, amount: event.target.value }))} placeholder="Monto" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
                  <input value={deliveryPaymentForm.reference} onChange={(event) => setDeliveryPaymentForm((current) => ({ ...current, reference: event.target.value }))} placeholder="Referencia" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
                  <textarea value={deliveryPaymentForm.notes} onChange={(event) => setDeliveryPaymentForm((current) => ({ ...current, notes: event.target.value }))} rows={3} placeholder="Notas" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
                  <button type="submit" disabled={saving} className="rounded-full bg-brand-500 px-4 py-3 text-sm font-semibold text-white">
                    Registrar liquidación
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "settings" ? (
        <form onSubmit={(event) => void savePlatformSettings(event)} className="rounded-[28px] bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold">Servicio global al comprador</h3>
          <p className="mt-2 text-sm text-zinc-600">Este valor aplica a toda compra confirmada y se muestra en carrito, checkout y pedidos.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
            <input
              type="number"
              min="0"
              step="0.01"
              value={serviceFee}
              onChange={(event) => setServiceFee(event.target.value)}
              className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
            />
            <button type="submit" disabled={saving} className="rounded-full bg-brand-500 px-4 py-3 text-sm font-semibold text-white disabled:bg-zinc-300">
              Guardar
            </button>
          </div>
          <p className="mt-3 text-xs text-zinc-500">Valor actual: {formatCurrency(platformSettings?.service_fee_amount ?? 0)}</p>
        </form>
      ) : null}

      {activeTab === "settlements" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-[28px] bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold">Comercios con saldo</h3>
            <div className="mt-4 space-y-3">
              {settlementStores.map((store) => (
                <div key={store.id} className="rounded-2xl bg-zinc-50 p-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <strong>{store.store_name}</strong>
                    <span>{formatCurrency(store.pending_balance)}</span>
                  </div>
                  <p className="mt-1 text-zinc-500">
                    {store.owner_name} | {store.pending_charges_count} cargos | {store.pending_notices_count} avisos
                  </p>
                </div>
              ))}
              {!settlementStores.length ? <p className="text-sm text-zinc-500">Sin saldos pendientes.</p> : null}
            </div>
          </article>

          <form onSubmit={(event) => void saveSettlementPayment(event)} className="rounded-[28px] bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold">Cargar pago manual</h3>
            <div className="mt-4 grid gap-3">
              <select value={paymentForm.store_id} onChange={(event) => setPaymentForm((current) => ({ ...current, store_id: event.target.value }))} className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3">
                {settlementStores.map((store) => <option key={store.id} value={store.id}>{store.store_name}</option>)}
              </select>
              <input type="number" min="0" step="0.01" value={paymentForm.amount} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} placeholder="Monto" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
              <input value={paymentForm.reference} onChange={(event) => setPaymentForm((current) => ({ ...current, reference: event.target.value }))} placeholder="Referencia" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
              <textarea value={paymentForm.notes} onChange={(event) => setPaymentForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Notas" rows={4} className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
              <button type="submit" disabled={saving} className="rounded-full bg-brand-500 px-4 py-3 text-sm font-semibold text-white disabled:bg-zinc-300">
                Registrar pago
              </button>
            </div>
          </form>

          <article className="rounded-[28px] bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold">Avisos pendientes</h3>
            <div className="mt-4 space-y-3">
              {settlementNotices.map((notice) => (
                <div key={notice.id} className="rounded-2xl bg-zinc-50 p-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <strong>{notice.store_name ?? "Comercio"}</strong>
                    <span>{formatCurrency(notice.amount)}</span>
                  </div>
                  <p className="mt-1 text-zinc-500">{notice.bank} | {notice.reference} | {statusLabels[notice.status] ?? notice.status}</p>
                  <textarea
                    value={noticeNotes[notice.id] ?? notice.reviewed_notes ?? ""}
                    onChange={(event) => setNoticeNotes((current) => ({ ...current, [notice.id]: event.target.value }))}
                    rows={2}
                    className="mt-3 w-full rounded-2xl border border-black/10 bg-white px-4 py-3"
                    placeholder="Notas de revision"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => void reviewNotice(notice.id, "approved")} className="rounded-full bg-emerald-500 px-3 py-2 text-xs font-semibold text-white" disabled={saving}>
                      Aprobar
                    </button>
                    <button type="button" onClick={() => void reviewNotice(notice.id, "rejected")} className="rounded-full bg-rose-500 px-3 py-2 text-xs font-semibold text-white" disabled={saving}>
                      Rechazar
                    </button>
                    <button type="button" onClick={() => void reviewNotice(notice.id, "pending")} className="rounded-full bg-zinc-900 px-3 py-2 text-xs font-semibold text-white" disabled={saving}>
                      Pendiente
                    </button>
                  </div>
                </div>
              ))}
              {!settlementNotices.length ? <p className="text-sm text-zinc-500">Sin avisos por revisar.</p> : null}
            </div>
          </article>

          <article className="rounded-[28px] bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold">Pagos aplicados</h3>
            <div className="mt-4 space-y-3">
              {settlementPayments.map((payment) => (
                <div key={payment.id} className="rounded-2xl bg-zinc-50 p-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <strong>{payment.store_name ?? "Comercio"}</strong>
                    <span>{formatCurrency(payment.amount)}</span>
                  </div>
                  <p className="mt-1 text-zinc-500">
                    Aplicado: {formatCurrency(payment.applied_amount)} | {payment.method} {payment.reference ? `| ${payment.reference}` : ""}
                  </p>
                </div>
              ))}
              {!settlementPayments.length ? <p className="text-sm text-zinc-500">Todavia no hay pagos imputados.</p> : null}
            </div>
          </article>
        </div>
      ) : null}

      {activeTab === "categories" ? (
        <div className="space-y-4">
          <form onSubmit={(event) => void handleCategoryCreate(event)} className="rounded-[28px] bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold">Nueva categoria</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Farmacias" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
              <input value={categoryDescription} onChange={(event) => setCategoryDescription(event.target.value)} placeholder="Salud y cuidado" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
              <button type="submit" disabled={saving} className="rounded-full bg-brand-500 px-4 py-3 text-sm font-semibold text-white disabled:bg-zinc-300">
                Crear
              </button>
            </div>
          </form>
          <div className="grid gap-3 md:grid-cols-2">
            {categories.map((category) => (
              <article key={category.id} className="rounded-[28px] bg-white p-5 shadow-sm">
                <h4 className="font-bold">{category.name}</h4>
                <p className="mt-2 text-sm text-zinc-600">{category.slug}</p>
                <p className="mt-1 text-sm text-zinc-500">{category.description ?? "Sin descripcion"}</p>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {activeTab === "applications" ? (
        <div className="space-y-4">
          {applications.map((application) => (
            <article key={application.id} className="rounded-[28px] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">{application.business_name}</h3>
                  <p className="text-sm text-zinc-600">{application.address}</p>
                </div>
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">{statusLabels[application.status] ?? application.status}</span>
              </div>
              <p className="mt-3 text-sm text-zinc-600">{application.description}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-zinc-500">
                {application.requested_category_names.map((name) => (
                  <span key={name} className="rounded-full bg-zinc-100 px-3 py-1">{name}</span>
                ))}
              </div>
              <textarea
                value={reviewNotes[application.id] ?? application.review_notes ?? ""}
                onChange={(event) => setReviewNotes((current) => ({ ...current, [application.id]: event.target.value }))}
                rows={3}
                className="mt-4 w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
                placeholder="Notas de revision"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => void handleReview(application.id, "approved")} className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white" disabled={saving}>
                  Aprobar
                </button>
                <button type="button" onClick={() => void handleReview(application.id, "rejected")} className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white" disabled={saving}>
                  Rechazar
                </button>
                <button type="button" onClick={() => void handleReview(application.id, "suspended")} className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white" disabled={saving}>
                  Suspender
                </button>
              </div>
            </article>
          ))}
          {!applications.length ? <EmptyCard title="Sin aplicaciones" description="Todavia no hay solicitudes de comercio." /> : null}
        </div>
      ) : null}

      {activeTab === "stores" ? (
        <div className="space-y-4">
          {stores.map((store) => (
            <article key={store.id} className="rounded-[28px] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">{store.name}</h3>
                  <p className="text-sm text-zinc-600">{store.address}</p>
                </div>
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">{statusLabels[store.status] ?? store.status}</span>
              </div>
              <p className="mt-3 text-sm text-zinc-600">{store.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => void handleStoreStatus(store.id, "approved")} className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white" disabled={saving}>
                  Aprobar
                </button>
                <button type="button" onClick={() => void handleStoreStatus(store.id, "rejected")} className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white" disabled={saving}>
                  Rechazar
                </button>
                <button type="button" onClick={() => void handleStoreStatus(store.id, "suspended")} className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white" disabled={saving}>
                  Suspender
                </button>
              </div>
            </article>
          ))}
          {!stores.length ? <EmptyCard title="Sin comercios" description="No hay comercios cargados todavia." /> : null}
        </div>
      ) : null}

      {activeTab === "orders" ? (
        <div className="space-y-4">
          {orders.map((order) => (
            <article key={order.id} className="rounded-[28px] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">Pedido #{order.id}</h3>
                  <p className="text-sm text-zinc-600">{order.store_name} - {order.customer_name}</p>
                </div>
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">{statusLabels[order.status] ?? order.status}</span>
              </div>
              <div className="mt-4 grid gap-2 text-sm text-zinc-600 md:grid-cols-4">
                <span>{paymentMethodLabels[order.payment_method]}</span>
                <span>{formatCurrency(order.total)}</span>
                <span>Servicio: {formatCurrency(order.service_fee)}</span>
                <span>{new Date(order.created_at).toLocaleString("es-AR")}</span>
              </div>
            </article>
          ))}
          {!orders.length ? <EmptyCard title="Sin pedidos" description="Los pedidos globales apareceran aca." /> : null}
        </div>
      ) : null}
    </div>
  );
}
