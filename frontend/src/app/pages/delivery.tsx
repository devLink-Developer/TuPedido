import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import {
  acceptDeliveryOrder,
  createDeliveryApplication,
  deliverDeliveryOrder,
  fetchDeliveryApplications,
  fetchDeliveryMe,
  fetchDeliveryNotifications,
  fetchDeliveryOrders,
  fetchDeliverySettlements,
  pickupDeliveryOrder,
  pushDeliveryLocation,
  updateDeliveryAvailability
} from "../api";
import { useSession } from "../session";
import type { DeliveryApplication, DeliveryApplicationCreate, DeliveryProfile, DeliverySettlement, Order } from "../types";
import { LiveMap } from "../../components/maps/LiveMap";
import { EmptyCard, LoadingCard, PageHeader, formatCurrency, roleHome, statusLabels } from "./common";

type AuthFormState = {
  full_name: string;
  email: string;
  password: string;
};

type DeliveryFormState = DeliveryApplicationCreate;

const emptyDeliveryForm: DeliveryFormState = {
  phone: "",
  vehicle_type: "motorcycle",
  photo_url: "",
  dni_number: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  license_number: "",
  vehicle_plate: "",
  insurance_policy: "",
  notes: ""
};

function OrderActionCard({
  order,
  onAccept,
  onPickup,
  onDeliver,
  delivering
}: {
  order: Order;
  onAccept: () => void;
  onPickup: () => void;
  onDeliver: (otp: string) => void;
  delivering: boolean;
}) {
  const [otpCode, setOtpCode] = useState("");
  const points = [
    order.store_latitude !== null && order.store_longitude !== null
      ? {
          id: "store",
          latitude: order.store_latitude,
          longitude: order.store_longitude,
          color: "linear-gradient(135deg,#f97316,#c2410c)",
          label: "Tienda"
        }
      : null,
    order.address_latitude !== null && order.address_longitude !== null
      ? {
          id: "customer",
          latitude: order.address_latitude,
          longitude: order.address_longitude,
          color: "linear-gradient(135deg,#1f2937,#111827)",
          label: "Destino"
        }
      : null,
    order.tracking_last_latitude !== null && order.tracking_last_longitude !== null
      ? {
          id: "rider",
          latitude: order.tracking_last_latitude,
          longitude: order.tracking_last_longitude,
          color: "linear-gradient(135deg,#10b981,#047857)",
          label: "Rider"
        }
      : null
  ].filter(Boolean) as Array<{ id: string; latitude: number; longitude: number; color: string; label: string }>;

  return (
    <article className="mesh-surface space-y-4 rounded border border-white/80 p-5 shadow-lift">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Pedido #{order.id}</p>
          <h3 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink">{order.store_name}</h3>
          <p className="mt-2 text-sm text-zinc-600">{order.address_full ?? order.address_label ?? "Retiro en local"}</p>
        </div>
        <div className="rounded bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
          {statusLabels[order.delivery_status] ?? order.delivery_status}
        </div>
      </div>

      {points.length ? <LiveMap points={points} className="h-56" /> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded bg-[#fff6ef] px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Total cliente</p>
          <p className="mt-2 text-lg font-bold text-ink">{formatCurrency(order.total)}</p>
        </div>
        <div className="rounded bg-[#f6fbf7] px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Ganancia rider</p>
          <p className="mt-2 text-lg font-bold text-ink">{formatCurrency(order.rider_fee)}</p>
        </div>
        <div className="rounded bg-[#f5f7fb] px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">ETA</p>
          <p className="mt-2 text-lg font-bold text-ink">{order.eta_minutes ? `${order.eta_minutes} min` : "Sin ETA"}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {order.delivery_status === "assignment_pending" ? (
          <button type="button" onClick={onAccept} className="rounded bg-brand-500 px-4 py-3 text-sm font-semibold text-white">
            Aceptar pedido
          </button>
        ) : null}
        {order.delivery_status === "assigned" || order.delivery_status === "heading_to_store" ? (
          <button type="button" onClick={onPickup} className="rounded bg-ink px-4 py-3 text-sm font-semibold text-white">
            Confirmar retiro
          </button>
        ) : null}
        {order.delivery_status === "picked_up" || order.delivery_status === "near_customer" ? (
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <input
              value={otpCode}
              onChange={(event) => setOtpCode(event.target.value)}
              placeholder="OTP cliente"
              className="min-w-[160px] flex-1 rounded border border-black/10 bg-white px-4 py-3 text-sm"
            />
            <button
              type="button"
              onClick={() => onDeliver(otpCode)}
              disabled={delivering}
              className="rounded bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:bg-zinc-300"
            >
              {delivering ? "Cerrando..." : "Entregar"}
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function DeliveryApplyPage() {
  const { user, token, loading: sessionLoading, login, register, refresh } = useSession();
  const [authMode, setAuthMode] = useState<"login" | "register">("register");
  const [authForm, setAuthForm] = useState<AuthFormState>({ full_name: "", email: "", password: "" });
  const [form, setForm] = useState<DeliveryFormState>(emptyDeliveryForm);
  const [applications, setApplications] = useState<DeliveryApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetchDeliveryApplications(token)
      .then(setApplications)
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudo cargar la postulacion"))
      .finally(() => setLoading(false));
  }, [token]);

  if (sessionLoading) return <LoadingCard />;
  if (user?.role === "delivery") return <Navigate to="/delivery" replace />;
  if (user && user.role !== "customer") return <Navigate to={roleHome[user.role]} replace />;

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setAuthError(null);
    try {
      if (authMode === "register") {
        await register(authForm.full_name, authForm.email, authForm.password);
      } else {
        await login(authForm.email, authForm.password);
      }
      await refresh();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "No se pudo validar tu cuenta");
    } finally {
      setSaving(false);
    }
  }

  async function handleApplySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const application = await createDeliveryApplication(token, {
        ...form,
        photo_url: form.photo_url || null,
        license_number: form.license_number || null,
        vehicle_plate: form.vehicle_plate || null,
        insurance_policy: form.insurance_policy || null,
        notes: form.notes || null
      });
      setApplications((current) => [application, ...current]);
      setForm(emptyDeliveryForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar la solicitud");
    } finally {
      setSaving(false);
    }
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Delivery"
          title="Regístrate para repartir"
          description="Primero crea o valida tu cuenta de cliente. Después completas tu postulación como rider y el admin la aprueba."
        />
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <form onSubmit={(event) => void handleAuthSubmit(event)} className="mesh-surface space-y-4 rounded border border-white/80 p-5 shadow-lift">
            <div className="flex gap-2">
              {(["register", "login"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setAuthMode(mode)}
                  className={`rounded px-4 py-2 text-sm font-semibold ${authMode === mode ? "bg-ink text-white" : "bg-zinc-100 text-zinc-600"}`}
                >
                  {mode === "register" ? "Crear cuenta" : "Ingresar"}
                </button>
              ))}
            </div>
            {authMode === "register" ? (
              <input
                value={authForm.full_name}
                onChange={(event) => setAuthForm((current) => ({ ...current, full_name: event.target.value }))}
                placeholder="Nombre completo"
                className="w-full rounded border border-black/10 bg-zinc-50 px-4 py-3"
                required
              />
            ) : null}
            <input
              value={authForm.email}
              onChange={(event) => setAuthForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="Email"
              type="email"
              className="w-full rounded border border-black/10 bg-zinc-50 px-4 py-3"
              required
            />
            <input
              value={authForm.password}
              onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))}
              placeholder="Contraseña"
              type="password"
              minLength={6}
              className="w-full rounded border border-black/10 bg-zinc-50 px-4 py-3"
              required
            />
            {authError ? <p className="rounded bg-rose-50 px-4 py-3 text-sm text-rose-700">{authError}</p> : null}
            <button type="submit" disabled={saving} className="rounded bg-brand-500 px-5 py-3 text-sm font-semibold text-white">
              {saving ? "Procesando..." : authMode === "register" ? "Crear cuenta y seguir" : "Ingresar y seguir"}
            </button>
          </form>

          <div className="rounded bg-[linear-gradient(180deg,#221816_0%,#171210_100%)] p-6 text-white shadow-lift">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#ffd0ba]/70">Flota centralizada</p>
            <h3 className="mt-3 font-display text-3xl font-bold tracking-tight">Pedidos con GPS, OTP y cuenta corriente</h3>
            <div className="mt-4 grid gap-3 text-sm text-white/75">
              <div className="rounded border border-white/10 bg-white/5 px-4 py-4">Tracking en tiempo real para cliente y comercio.</div>
              <div className="rounded border border-white/10 bg-white/5 px-4 py-4">Despacho por cercanía y mapa operativo mobile-first.</div>
              <div className="rounded border border-white/10 bg-white/5 px-4 py-4">Liquidación de entregas, cobros cash y notificaciones del pedido.</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Alta delivery"
        title="Postúlate como repartidor"
        description="Completa tus datos, tipo de vehículo y documentación operativa. El admin revisa y aprueba el acceso."
      />
      <form onSubmit={(event) => void handleApplySubmit(event)} className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="mesh-surface grid gap-4 rounded border border-white/80 p-5 shadow-lift md:grid-cols-2">
          <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Teléfono" className="rounded border border-black/10 bg-zinc-50 px-4 py-3" required />
          <select value={form.vehicle_type} onChange={(event) => setForm((current) => ({ ...current, vehicle_type: event.target.value as DeliveryFormState["vehicle_type"] }))} className="rounded border border-black/10 bg-zinc-50 px-4 py-3">
            <option value="bicycle">Bicicleta</option>
            <option value="motorcycle">Moto</option>
            <option value="car">Auto</option>
          </select>
          <input value={form.dni_number} onChange={(event) => setForm((current) => ({ ...current, dni_number: event.target.value }))} placeholder="DNI" className="rounded border border-black/10 bg-zinc-50 px-4 py-3" required />
          <input value={form.photo_url ?? ""} onChange={(event) => setForm((current) => ({ ...current, photo_url: event.target.value }))} placeholder="Foto / URL opcional" className="rounded border border-black/10 bg-zinc-50 px-4 py-3" />
          <input value={form.emergency_contact_name} onChange={(event) => setForm((current) => ({ ...current, emergency_contact_name: event.target.value }))} placeholder="Contacto de emergencia" className="rounded border border-black/10 bg-zinc-50 px-4 py-3" required />
          <input value={form.emergency_contact_phone} onChange={(event) => setForm((current) => ({ ...current, emergency_contact_phone: event.target.value }))} placeholder="Teléfono emergencia" className="rounded border border-black/10 bg-zinc-50 px-4 py-3" required />
          <input value={form.license_number ?? ""} onChange={(event) => setForm((current) => ({ ...current, license_number: event.target.value }))} placeholder="Licencia" className="rounded border border-black/10 bg-zinc-50 px-4 py-3" />
          <input value={form.vehicle_plate ?? ""} onChange={(event) => setForm((current) => ({ ...current, vehicle_plate: event.target.value }))} placeholder="Patente" className="rounded border border-black/10 bg-zinc-50 px-4 py-3" />
          <input value={form.insurance_policy ?? ""} onChange={(event) => setForm((current) => ({ ...current, insurance_policy: event.target.value }))} placeholder="Seguro" className="rounded border border-black/10 bg-zinc-50 px-4 py-3 md:col-span-2" />
          <textarea value={form.notes ?? ""} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Notas adicionales" rows={4} className="rounded border border-black/10 bg-zinc-50 px-4 py-3 md:col-span-2" />
        </div>

        <div className="rounded bg-[linear-gradient(180deg,#221816_0%,#171210_100%)] p-6 text-white shadow-lift">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#ffd0ba]/70">Checklist</p>
          <h3 className="mt-3 font-display text-3xl font-bold tracking-tight">Qué valida el admin</h3>
          <div className="mt-4 grid gap-3 text-sm text-white/75">
            <div className="rounded border border-white/10 bg-white/5 px-4 py-4">Identidad, contacto y disponibilidad operativa.</div>
            <div className="rounded border border-white/10 bg-white/5 px-4 py-4">Licencia, patente y seguro para moto o auto.</div>
            <div className="rounded border border-white/10 bg-white/5 px-4 py-4">Acceso a tracking, notificaciones y flota solo cuando el alta esté aprobada.</div>
          </div>
          {error ? <p className="mt-4 rounded bg-rose-500/15 px-4 py-3 text-sm text-rose-100">{error}</p> : null}
          <button type="submit" disabled={saving} className="mt-4 rounded bg-brand-500 px-5 py-3 text-sm font-semibold text-white">
            {saving ? "Enviando..." : "Enviar postulación"}
          </button>
        </div>
      </form>

      <div className="space-y-3">
        {loading ? <LoadingCard /> : null}
        {applications.map((application) => (
          <article key={application.id} className="rounded bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">{application.user_name}</h3>
                <p className="text-sm text-zinc-600">{application.vehicle_type} · {application.phone}</p>
              </div>
              <span className="rounded bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                {statusLabels[application.status] ?? application.status}
              </span>
            </div>
            <p className="mt-3 text-sm text-zinc-600">{application.review_notes ?? "Solicitud enviada, pendiente de revisión."}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

export function DeliveryDashboardPage() {
  const { token, user } = useSession();
  const [profile, setProfile] = useState<DeliveryProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [settlement, setSettlement] = useState<DeliverySettlement | null>(null);
  const [notifications, setNotifications] = useState<Array<{ id: number; title: string; body: string; created_at: string; is_read: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<number | null>(null);

  const activeOrder = useMemo(
    () =>
      orders.find((order) =>
        ["assignment_pending", "assigned", "heading_to_store", "picked_up", "near_customer"].includes(order.delivery_status)
      ) ?? null,
    [orders]
  );

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([fetchDeliveryMe(token), fetchDeliveryOrders(token), fetchDeliverySettlements(token), fetchDeliveryNotifications(token)])
      .then(([profileData, orderList, settlementData, notificationList]) => {
        setProfile(profileData);
        setOrders(orderList);
        setSettlement(settlementData);
        setNotifications(notificationList);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudo cargar el panel de reparto"))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token || !activeOrder || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        void pushDeliveryLocation(token, {
          order_id: activeOrder.id,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          heading: position.coords.heading ?? null,
          speed_kmh: position.coords.speed ? position.coords.speed * 3.6 : null,
          accuracy_meters: position.coords.accuracy
        }).then((updated) => {
          setOrders((current) => current.map((order) => (order.id === updated.id ? updated : order)));
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [activeOrder, token]);

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "delivery") return <Navigate to={roleHome[user.role]} replace />;
  if (loading) return <LoadingCard label="Cargando operación de delivery..." />;
  if (error) return <EmptyCard title="No se pudo abrir el panel" description={error} />;
  if (!profile || !settlement) return <EmptyCard title="Perfil incompleto" description="Tu alta delivery todavía no está disponible." />;

  async function changeAvailability(next: DeliveryProfile["availability"]) {
    if (!token || !profile) return;
    const nextProfile = await updateDeliveryAvailability(token, { availability: next, zone_id: profile.current_zone_id });
    setProfile(nextProfile);
  }

  async function handleAccept(orderId: number) {
    if (!token) return;
    setBusyOrderId(orderId);
    try {
      const updated = await acceptDeliveryOrder(token, orderId);
      setOrders((current) => current.map((order) => (order.id === updated.id ? updated : order)));
    } finally {
      setBusyOrderId(null);
    }
  }

  async function handlePickup(orderId: number) {
    if (!token) return;
    setBusyOrderId(orderId);
    try {
      const updated = await pickupDeliveryOrder(token, orderId);
      setOrders((current) => current.map((order) => (order.id === updated.id ? updated : order)));
    } finally {
      setBusyOrderId(null);
    }
  }

  async function handleDeliver(orderId: number, otp: string) {
    if (!token) return;
    setBusyOrderId(orderId);
    try {
      const updated = await deliverDeliveryOrder(token, orderId, otp);
      setOrders((current) => current.map((order) => (order.id === updated.id ? updated : order)));
    } finally {
      setBusyOrderId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Delivery"
        title="Operación de reparto"
        description="Controla disponibilidad, acepta viajes, sigue el pedido con mapa vivo y cierra entregas con OTP."
        action={
          <div className="flex flex-wrap gap-2">
            {(["offline", "idle", "paused"] as const).map((availability) => (
              <button
                key={availability}
                type="button"
                onClick={() => void changeAvailability(availability)}
                className={`rounded px-4 py-2 text-sm font-semibold ${
                  profile.availability === availability ? "bg-white text-ink" : "border border-white/15 text-white/80"
                }`}
              >
                {availability === "idle" ? "Disponible" : availability === "paused" ? "Pausa" : "Offline"}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <div className="mesh-surface rounded border border-white/80 p-5 shadow-lift">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Estado</p>
          <h3 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink">{profile.availability}</h3>
          <p className="mt-2 text-sm text-zinc-600">{profile.vehicle_type} · {profile.completed_deliveries} entregas</p>
        </div>
        <div className="mesh-surface rounded border border-white/80 p-5 shadow-lift">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Ganado</p>
          <h3 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink">{formatCurrency(settlement.rider_fee_earned_total)}</h3>
          <p className="mt-2 text-sm text-zinc-600">Total por entregas realizadas</p>
        </div>
        <div className="mesh-surface rounded border border-white/80 p-5 shadow-lift">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Cobrado cash</p>
          <h3 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink">{formatCurrency(settlement.cash_liability_total)}</h3>
          <p className="mt-2 text-sm text-zinc-600">A rendir a la plataforma</p>
        </div>
        <div className="mesh-surface rounded border border-white/80 p-5 shadow-lift">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Pagado</p>
          <h3 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink">{formatCurrency(settlement.rider_fee_paid_total)}</h3>
          <p className="mt-2 text-sm text-zinc-600">Liquidaciones registradas</p>
        </div>
      </div>

      {activeOrder ? (
        <OrderActionCard
          order={activeOrder}
          onAccept={() => void handleAccept(activeOrder.id)}
          onPickup={() => void handlePickup(activeOrder.id)}
          onDeliver={(otp) => void handleDeliver(activeOrder.id, otp)}
          delivering={busyOrderId === activeOrder.id}
        />
      ) : (
        <EmptyCard title="Sin pedido activo" description="Cuando haya una asignación o un viaje en curso aparecerá aquí con tracking en tiempo real." />
      )}

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-3">
          {orders.map((order) => (
            <article key={order.id} className="rounded bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">{order.store_name}</h3>
                  <p className="text-sm text-zinc-600">{order.address_full ?? "Retiro en local"}</p>
                </div>
                <span className="rounded bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                  {statusLabels[order.delivery_status] ?? order.delivery_status}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-sm text-zinc-600">
                <span>Cliente: {formatCurrency(order.total)}</span>
                <span>Rider: {formatCurrency(order.rider_fee)}</span>
                <span>{new Date(order.created_at).toLocaleString("es-AR")}</span>
              </div>
            </article>
          ))}
        </div>

        <div className="space-y-3">
          {notifications.map((notification) => (
            <article key={notification.id} className="rounded bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-ink">{notification.title}</h3>
                  <p className="mt-1 text-sm text-zinc-600">{notification.body}</p>
                </div>
                {!notification.is_read ? <span className="rounded bg-brand-100 px-2 py-1 text-[10px] font-semibold text-brand-700">Nueva</span> : null}
              </div>
              <p className="mt-3 text-xs uppercase tracking-[0.18em] text-zinc-400">{new Date(notification.created_at).toLocaleString("es-AR")}</p>
            </article>
          ))}
          {!notifications.length ? <EmptyCard title="Sin alertas" description="Las ofertas, reasignaciones y liquidaciones van a aparecer en este panel." /> : null}
        </div>
      </div>
    </div>
  );
}
