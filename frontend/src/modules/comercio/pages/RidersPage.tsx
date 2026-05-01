import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { EmptyState, ImageAssetField, LoadingCard, PageHeader, StatCard } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import {
  assignMerchantOrderRider,
  createMerchantRider,
  fetchMerchantOrders,
  fetchMerchantRiders,
  updateMerchantRider
} from "../../../shared/services/api";
import type { DeliveryProfile, DeliveryVehicleType, MerchantRiderCreate, MerchantRiderUpdate, Order } from "../../../shared/types";
import { Button } from "../../../shared/ui/Button";
import { HelpTooltip } from "../../../shared/ui/HelpTooltip";
import { formatDateTime } from "../../../shared/utils/format";
import { statusLabels } from "../../../shared/utils/labels";

type RiderFormState = {
  full_name: string;
  email: string;
  password: string;
  phone: string;
  vehicle_type: DeliveryVehicleType;
  dni_number: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  photo_url: string;
  license_number: string;
  vehicle_plate: string;
  insurance_policy: string;
  notes: string;
  is_active: boolean;
};

const emptyForm: RiderFormState = {
  full_name: "",
  email: "",
  password: "",
  phone: "",
  vehicle_type: "motorcycle",
  dni_number: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  photo_url: "",
  license_number: "",
  vehicle_plate: "",
  insurance_policy: "",
  notes: "",
  is_active: true
};

function canAssign(order: Order) {
  return (
    order.delivery_mode === "delivery" &&
    !["cancelled", "delivered", "delivery_failed"].includes(order.status) &&
    (order.status === "ready_for_dispatch" ||
      ["assignment_pending", "assigned", "heading_to_store"].includes(order.delivery_status))
  );
}

function toForm(rider: DeliveryProfile): RiderFormState {
  return {
    full_name: rider.full_name,
    email: rider.email,
    password: "",
    phone: rider.phone,
    vehicle_type: rider.vehicle_type,
    dni_number: rider.dni_number,
    emergency_contact_name: rider.emergency_contact_name,
    emergency_contact_phone: rider.emergency_contact_phone,
    photo_url: rider.photo_url ?? "",
    license_number: rider.license_number ?? "",
    vehicle_plate: rider.vehicle_plate ?? "",
    insurance_policy: rider.insurance_policy ?? "",
    notes: rider.notes ?? "",
    is_active: rider.is_active
  };
}

const vehicleLabels: Record<DeliveryVehicleType, string> = {
  bicycle: "Bicicleta",
  motorcycle: "Moto",
  car: "Auto"
};

function AvailabilityBadge({ rider }: { rider: DeliveryProfile }) {
  const isIdle = rider.availability === "idle";
  return (
    <span
      className={[
        "rounded border px-3 py-1 text-xs font-semibold",
        isIdle
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : rider.is_active
            ? "border-amber-200 bg-amber-50 text-amber-800"
            : "border-zinc-200 bg-zinc-100 text-zinc-500"
      ].join(" ")}
    >
      {statusLabels[rider.availability] ?? rider.availability}
    </span>
  );
}

export function RidersPage() {
  const { token } = useAuthSession();
  const [riders, setRiders] = useState<DeliveryProfile[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<number, string>>({});
  const [form, setForm] = useState<RiderFormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingForm, setSavingForm] = useState(false);
  const [busyOrderId, setBusyOrderId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const activeRiders = useMemo(() => riders.filter((rider) => rider.is_active), [riders]);
  const idleRiders = useMemo(() => riders.filter((rider) => rider.is_active && rider.availability === "idle"), [riders]);
  const busyRiders = useMemo(
    () => riders.filter((rider) => rider.is_active && ["reserved", "delivering", "heading_to_store"].includes(rider.availability)),
    [riders]
  );
  const dispatchOrders = useMemo(() => orders.filter((order) => canAssign(order)), [orders]);

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const [riderResults, orderResults] = await Promise.all([
        fetchMerchantRiders(token),
        fetchMerchantOrders(token)
      ]);
      setRiders(riderResults);
      setOrders(orderResults);
      setError(null);
      setActionError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudieron cargar los repartidores");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  useEffect(() => {
    setAssignmentDrafts((current) => {
      const next = { ...current };
      for (const order of dispatchOrders) {
        const candidates = riders.filter(
          (rider) => rider.is_active && (rider.availability === "idle" || rider.user_id === order.assigned_rider_id)
        );
        if (!next[order.id] || !candidates.some((rider) => String(rider.user_id) === next[order.id])) {
          next[order.id] = String(order.assigned_rider_id ?? candidates[0]?.user_id ?? "");
        }
      }
      return next;
    });
  }, [dispatchOrders, riders]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setFormOpen(false);
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setSavingForm(true);
    setFormError(null);
    try {
      if (editingId === null) {
        const payload: MerchantRiderCreate = {
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          password: form.password,
          phone: form.phone.trim(),
          vehicle_type: form.vehicle_type,
          dni_number: form.dni_number.trim(),
          emergency_contact_name: form.emergency_contact_name.trim(),
          emergency_contact_phone: form.emergency_contact_phone.trim(),
          photo_url: form.photo_url.trim() || null,
          license_number: form.license_number.trim() || null,
          vehicle_plate: form.vehicle_plate.trim() || null,
          insurance_policy: form.insurance_policy.trim() || null,
          notes: form.notes.trim() || null
        };
        await createMerchantRider(token, payload);
      } else {
        const payload: MerchantRiderUpdate = {
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          vehicle_type: form.vehicle_type,
          dni_number: form.dni_number.trim(),
          emergency_contact_name: form.emergency_contact_name.trim(),
          emergency_contact_phone: form.emergency_contact_phone.trim(),
          photo_url: form.photo_url.trim() || null,
          license_number: form.license_number.trim() || null,
          vehicle_plate: form.vehicle_plate.trim() || null,
          insurance_policy: form.insurance_policy.trim() || null,
          notes: form.notes.trim() || null,
          is_active: form.is_active
        };
        await updateMerchantRider(token, editingId, payload);
      }
      resetForm();
      await load();
    } catch (requestError) {
      setFormError(requestError instanceof Error ? requestError.message : "No se pudo guardar el repartidor");
    } finally {
      setSavingForm(false);
    }
  }

  async function handleAssign(orderId: number) {
    if (!token) return;
    const riderUserId = Number(assignmentDrafts[orderId] ?? "");
    if (!riderUserId) return;
    setBusyOrderId(orderId);
    setActionError(null);
    try {
      await assignMerchantOrderRider(token, orderId, riderUserId);
      await load();
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "No se pudo asignar el repartidor");
    } finally {
      setBusyOrderId(null);
    }
  }

  if (loading) return <LoadingCard label="Cargando repartidores..." />;
  if (error) return <EmptyState title="Repartidores no disponibles" description={error} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Comercio"
        title={
          <span className="inline-flex items-center gap-3">
            <span>Repartidores</span>
            <HelpTooltip label="Ayuda sobre repartidores" variant="inverse">
              Administra tu equipo de reparto y asigna repartidores a los pedidos listos.
            </HelpTooltip>
          </span>
        }
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="bg-brand-500 text-white"
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nuevo repartidor
            </Button>
            <Button type="button" className="bg-white/10 text-white shadow-none" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Actualizar
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Disponibles" value={String(idleRiders.length)} description="Repartidores listos para tomar pedidos" />
        <StatCard label="Ocupados" value={String(busyRiders.length)} description="Asignados o con entrega en curso" />
        <StatCard label="Por asignar" value={String(dispatchOrders.length)} description="Pedidos listos o en reasignación" />
        <StatCard label="Activos" value={String(activeRiders.length)} description="Repartidores operativos en el comercio" />
      </div>

      <section className="app-panel rounded p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--kp-accent)]">Disponibilidad</p>
            <div className="mt-2 flex items-center gap-2">
              <h2 className="text-xl font-bold text-ink">Equipo en línea</h2>
              <HelpTooltip label="Ayuda sobre disponibilidad">
                Revisa quién puede tomar pedidos antes de asignar despachos.
              </HelpTooltip>
            </div>
          </div>
          <Button
            type="button"
            className="bg-brand-500 text-white"
            onClick={() => {
              setEditingId(null);
              setForm(emptyForm);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Crear repartidor
          </Button>
        </div>

        {riders.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {riders.map((rider) => (
              <article key={rider.user_id} className="rounded border border-[var(--kp-stroke)] bg-white/90 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-ink">{rider.full_name}</h3>
                    <p className="mt-1 text-[13px] text-zinc-600">{rider.phone}</p>
                  </div>
                  <AvailabilityBadge rider={rider} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-zinc-600">
                  <span className="rounded bg-zinc-100 px-2.5 py-1">{vehicleLabels[rider.vehicle_type]}</span>
                  <span className="rounded bg-zinc-100 px-2.5 py-1">{rider.is_active ? "Activo" : "Inactivo"}</span>
                  <span className="rounded bg-zinc-100 px-2.5 py-1">{rider.completed_deliveries} entregas</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="Sin repartidores cargados" description="Crea el primer repartidor del comercio para empezar a operar con envíos." />
        )}
      </section>

      {actionError ? (
        <p className="rounded border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          {actionError}
        </p>
      ) : null}

      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Asignación</p>
          <div className="mt-2 flex items-center gap-2">
            <h2 className="text-xl font-bold text-ink">Pedidos listos para repartir</h2>
            <HelpTooltip label="Ayuda sobre asignación">
              Elige un repartidor disponible para los pedidos listos para despacho.
            </HelpTooltip>
          </div>
        </div>
        {dispatchOrders.length ? (
          <div className="space-y-4">
            {dispatchOrders.map((order) => {
              const candidates = riders.filter(
                (rider) => rider.is_active && (rider.availability === "idle" || rider.user_id === order.assigned_rider_id)
              );
              return (
                <article key={order.id} className="app-panel rounded p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-ink">Pedido #{order.id}</h3>
                      <p className="text-sm text-zinc-600">
                        {order.customer_name} | {formatDateTime(order.created_at)}
                      </p>
                    </div>
                    <span className="rounded bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
                      {statusLabels[order.delivery_status] ?? order.delivery_status}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm text-zinc-600 md:grid-cols-2 xl:grid-cols-4">
                    <p>Pago: {statusLabels[order.payment_status] ?? order.payment_status}</p>
                    <p>Repartidor actual: {order.assigned_rider_name ?? "Sin asignar"}</p>
                    <p>Estado pedido: {statusLabels[order.status] ?? order.status}</p>
                    <p>Tipo: {order.delivery_mode === "delivery" ? "Envío" : "Retiro"}</p>
                  </div>
                  <div className="mt-4 flex flex-col gap-2 md:flex-row">
                    <select
                      value={assignmentDrafts[order.id] ?? ""}
                      onChange={(event) => setAssignmentDrafts((current) => ({ ...current, [order.id]: event.target.value }))}
                      disabled={!candidates.length || busyOrderId === order.id}
                      className="min-w-[240px] rounded border border-black/10 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 outline-none"
                    >
                      {!candidates.length ? <option value="">Sin repartidores disponibles</option> : null}
                      {candidates.map((rider) => (
                        <option key={rider.user_id} value={rider.user_id}>
                          {rider.full_name} | {statusLabels[rider.availability] ?? rider.availability}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      disabled={!assignmentDrafts[order.id] || busyOrderId === order.id}
                      onClick={() => void handleAssign(order.id)}
                    >
                      {busyOrderId === order.id ? "Asignando..." : order.assigned_rider_id ? "Reasignar repartidor" : "Asignar repartidor"}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState title="Sin pedidos para asignar" description="Cuando un pedido quede listo para despacho aparecerá aquí." />
        )}
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Equipo</p>
          <div className="mt-2 flex items-center gap-2">
            <h2 className="text-xl font-bold text-ink">Datos de repartidores</h2>
            <HelpTooltip label="Ayuda sobre datos de repartidores">
              Consulta datos administrativos y edita cada perfil cuando lo necesites.
            </HelpTooltip>
          </div>
        </div>
        {riders.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {riders.map((rider) => (
              <article key={rider.user_id} className="rounded bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-ink">{rider.full_name}</h3>
                    <p className="text-sm text-zinc-600">
                      {rider.phone} | {rider.email}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <AvailabilityBadge rider={rider} />
                    <span className="rounded bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
                      {rider.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 text-sm text-zinc-600 md:grid-cols-2">
                  <p>Vehículo: {vehicleLabels[rider.vehicle_type]}</p>
                  <p>DNI: {rider.dni_number}</p>
                  <p>Entregas: {rider.completed_deliveries}</p>
                  <p>Última ubicación: {rider.last_location_at ? formatDateTime(rider.last_location_at) : "Sin datos"}</p>
                </div>
                {(rider.license_number || rider.vehicle_plate || rider.notes) ? (
                  <div className="mt-4 rounded bg-zinc-50 p-4 text-sm text-zinc-600">
                    {rider.license_number ? <p>Licencia: {rider.license_number}</p> : null}
                    {rider.vehicle_plate ? <p>Patente: {rider.vehicle_plate}</p> : null}
                    {rider.notes ? <p className="mt-2">{rider.notes}</p> : null}
                  </div>
                ) : null}
                <div className="mt-4">
                  <Button
                    type="button"
                    className="shadow-none"
                    onClick={() => {
                      setEditingId(rider.user_id);
                      setForm(toForm(rider));
                      setFormOpen(true);
                      setFormError(null);
                    }}
                  >
                    Editar repartidor
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="Sin repartidores cargados" description="Crea el primer repartidor del comercio para empezar a operar con envíos." />
        )}
      </section>

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-[rgba(92,52,24,0.24)] p-4 backdrop-blur-[2px] md:items-center">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded bg-[linear-gradient(180deg,#fcf6ef_0%,#fffdfa_100%)] p-3 shadow-[0_32px_80px_rgba(24,19,18,0.28)] md:p-5">
            <div className="mb-4 flex items-center justify-between gap-3 px-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Repartidores</p>
                <h2 className="mt-2 text-2xl font-bold text-ink">{editingId === null ? "Nuevo repartidor" : "Editar repartidor"}</h2>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="kp-soft-action min-h-[40px] px-4 py-2 text-sm"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5 rounded bg-white p-5 shadow-sm">
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={form.full_name}
                  onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))}
                  placeholder="Nombre completo"
                  className="rounded border border-black/10 bg-zinc-50 px-4 py-3"
                  required
                />
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="Email"
                  className="rounded border border-black/10 bg-zinc-50 px-4 py-3"
                  required
                  disabled={editingId !== null}
                />
                {editingId === null ? (
                  <input
                    type="password"
                    value={form.password}
                    onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                    placeholder="Contraseña inicial"
                    className="rounded border border-black/10 bg-zinc-50 px-4 py-3"
                    minLength={6}
                    required
                  />
                ) : (
                  <label className="flex items-center gap-2 rounded border border-black/10 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
                    />
                    Repartidor activo
                  </label>
                )}
                <input
                  value={form.phone}
                  onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                  placeholder="Teléfono"
                  className="rounded border border-black/10 bg-zinc-50 px-4 py-3"
                  required
                />
                <select
                  value={form.vehicle_type}
                  onChange={(event) => setForm((current) => ({ ...current, vehicle_type: event.target.value as DeliveryVehicleType }))}
                  className="rounded border border-black/10 bg-zinc-50 px-4 py-3"
                >
                  <option value="bicycle">Bicicleta</option>
                  <option value="motorcycle">Moto</option>
                  <option value="car">Auto</option>
                </select>
                <input
                  value={form.dni_number}
                  onChange={(event) => setForm((current) => ({ ...current, dni_number: event.target.value }))}
                  placeholder="DNI"
                  className="rounded border border-black/10 bg-zinc-50 px-4 py-3"
                  required
                />
                <input
                  value={form.emergency_contact_name}
                  onChange={(event) => setForm((current) => ({ ...current, emergency_contact_name: event.target.value }))}
                  placeholder="Contacto de emergencia"
                  className="rounded border border-black/10 bg-zinc-50 px-4 py-3"
                  required
                />
                <input
                  value={form.emergency_contact_phone}
                  onChange={(event) => setForm((current) => ({ ...current, emergency_contact_phone: event.target.value }))}
                  placeholder="Teléfono de emergencia"
                  className="rounded border border-black/10 bg-zinc-50 px-4 py-3"
                  required
                />
                <input
                  value={form.license_number}
                  onChange={(event) => setForm((current) => ({ ...current, license_number: event.target.value }))}
                  placeholder="Licencia"
                  className="rounded border border-black/10 bg-zinc-50 px-4 py-3"
                />
                <input
                  value={form.vehicle_plate}
                  onChange={(event) => setForm((current) => ({ ...current, vehicle_plate: event.target.value }))}
                  placeholder="Patente"
                  className="rounded border border-black/10 bg-zinc-50 px-4 py-3"
                />
                <input
                  value={form.insurance_policy}
                  onChange={(event) => setForm((current) => ({ ...current, insurance_policy: event.target.value }))}
                  placeholder="Seguro"
                  className="rounded border border-black/10 bg-zinc-50 px-4 py-3 md:col-span-2"
                />
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  rows={3}
                  placeholder="Notas"
                  className="rounded border border-black/10 bg-zinc-50 px-4 py-3 md:col-span-2"
                />
              </div>
              <ImageAssetField
                label="Foto del repartidor"
                value={form.photo_url}
                onChange={(value) => setForm((current) => ({ ...current, photo_url: value }))}
                folder="riders"
                description="Carga una foto desde el dispositivo o pega una URL."
                previewClassName="h-56 w-full object-contain bg-white p-4"
              />
              {formError ? <p className="rounded bg-rose-50 px-4 py-3 text-sm text-rose-700">{formError}</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={savingForm}>
                  {savingForm ? "Guardando..." : editingId === null ? "Crear repartidor" : "Guardar cambios"}
                </Button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-700"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
