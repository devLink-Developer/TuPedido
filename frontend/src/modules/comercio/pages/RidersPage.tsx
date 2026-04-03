import { useEffect, useMemo, useState, type FormEvent } from "react";
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
      setError(requestError instanceof Error ? requestError.message : "No se pudieron cargar los riders");
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
      setFormError(requestError instanceof Error ? requestError.message : "No se pudo guardar el rider");
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
      setActionError(requestError instanceof Error ? requestError.message : "No se pudo asignar el rider");
    } finally {
      setBusyOrderId(null);
    }
  }

  if (loading) return <LoadingCard label="Cargando riders..." />;
  if (error) return <EmptyState title="Riders no disponibles" description={error} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Comercio"
        title={
          <span className="inline-flex items-center gap-3">
            <span>Riders</span>
            <HelpTooltip label="Ayuda sobre riders" variant="inverse">
              Administra tu equipo de reparto y asigna riders a los pedidos listos.
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
              Nuevo rider
            </Button>
            <Button type="button" className="bg-white/10 text-white shadow-none" onClick={() => void load()}>
              Actualizar
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Activos" value={String(activeRiders.length)} description="Riders operativos en el comercio" />
        <StatCard label="Totales" value={String(riders.length)} description="Altas directas creadas desde este panel" />
        <StatCard label="Disponibles" value={String(riders.filter((rider) => rider.availability === "idle").length)} description="Riders listos para tomar pedidos" />
        <StatCard label="Por asignar" value={String(dispatchOrders.length)} description="Pedidos listos o en reasignacion" />
      </div>

      {actionError ? (
        <p className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          {actionError}
        </p>
      ) : null}

      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Equipo</p>
          <div className="mt-2 flex items-center gap-2">
            <h2 className="text-xl font-bold text-ink">Riders configurados</h2>
            <HelpTooltip label="Ayuda sobre riders configurados">
              Consulta tus riders activos y edita sus datos cuando lo necesites.
            </HelpTooltip>
          </div>
        </div>
        {riders.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {riders.map((rider) => (
              <article key={rider.user_id} className="rounded-[28px] bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-ink">{rider.full_name}</h3>
                    <p className="text-sm text-zinc-600">
                      {rider.phone} | {rider.email}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
                      {statusLabels[rider.availability] ?? rider.availability}
                    </span>
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
                      {rider.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 text-sm text-zinc-600 md:grid-cols-2">
                  <p>Vehiculo: {rider.vehicle_type}</p>
                  <p>DNI: {rider.dni_number}</p>
                  <p>Entregas: {rider.completed_deliveries}</p>
                  <p>Ultima ubicacion: {rider.last_location_at ? formatDateTime(rider.last_location_at) : "Sin datos"}</p>
                </div>
                {(rider.license_number || rider.vehicle_plate || rider.notes) ? (
                  <div className="mt-4 rounded-[22px] bg-zinc-50 p-4 text-sm text-zinc-600">
                    {rider.license_number ? <p>Licencia: {rider.license_number}</p> : null}
                    {rider.vehicle_plate ? <p>Patente: {rider.vehicle_plate}</p> : null}
                    {rider.notes ? <p className="mt-2">{rider.notes}</p> : null}
                  </div>
                ) : null}
                <div className="mt-4">
                  <Button
                    type="button"
                    className="bg-zinc-900 shadow-none"
                    onClick={() => {
                      setEditingId(rider.user_id);
                      setForm(toForm(rider));
                      setFormOpen(true);
                      setFormError(null);
                    }}
                  >
                    Editar rider
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="Sin riders cargados" description="Crea el primer rider del comercio para empezar a operar con envios." />
        )}
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Asignacion</p>
          <div className="mt-2 flex items-center gap-2">
            <h2 className="text-xl font-bold text-ink">Pedidos listos para rider</h2>
            <HelpTooltip label="Ayuda sobre asignacion">
              Elige un rider disponible para los pedidos listos para despacho.
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
                <article key={order.id} className="rounded-[28px] bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-ink">Pedido #{order.id}</h3>
                      <p className="text-sm text-zinc-600">
                        {order.customer_name} | {formatDateTime(order.created_at)}
                      </p>
                    </div>
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
                      {statusLabels[order.delivery_status] ?? order.delivery_status}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm text-zinc-600 md:grid-cols-2 xl:grid-cols-4">
                    <p>Pago: {statusLabels[order.payment_status] ?? order.payment_status}</p>
                    <p>Rider actual: {order.assigned_rider_name ?? "Sin asignar"}</p>
                    <p>Estado pedido: {statusLabels[order.status] ?? order.status}</p>
                    <p>Tipo: {order.delivery_mode === "delivery" ? "Envio" : "Retiro"}</p>
                  </div>
                  <div className="mt-4 flex flex-col gap-2 md:flex-row">
                    <select
                      value={assignmentDrafts[order.id] ?? ""}
                      onChange={(event) => setAssignmentDrafts((current) => ({ ...current, [order.id]: event.target.value }))}
                      disabled={!candidates.length || busyOrderId === order.id}
                      className="min-w-[240px] rounded-full border border-black/10 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 outline-none"
                    >
                      {!candidates.length ? <option value="">Sin riders disponibles</option> : null}
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
                      {busyOrderId === order.id ? "Asignando..." : order.assigned_rider_id ? "Reasignar rider" : "Asignar rider"}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState title="Sin pedidos para asignar" description="Cuando un pedido quede listo para despacho aparecera aqui." />
        )}
      </section>

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-[rgba(17,24,39,0.48)] p-4 md:items-center">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[32px] bg-[linear-gradient(180deg,#fcf6ef_0%,#fffdfa_100%)] p-3 shadow-[0_32px_80px_rgba(24,19,18,0.28)] md:p-5">
            <div className="mb-4 flex items-center justify-between gap-3 px-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Riders</p>
                <h2 className="mt-2 text-2xl font-bold text-ink">{editingId === null ? "Nuevo rider" : "Editar rider"}</h2>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5 rounded-[28px] bg-white p-5 shadow-sm">
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={form.full_name}
                  onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))}
                  placeholder="Nombre completo"
                  className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
                  required
                />
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="Email"
                  className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
                  required
                  disabled={editingId !== null}
                />
                {editingId === null ? (
                  <input
                    type="password"
                    value={form.password}
                    onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                    placeholder="Contrasena inicial"
                    className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
                    minLength={6}
                    required
                  />
                ) : (
                  <label className="flex items-center gap-2 rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
                    />
                    Rider activo
                  </label>
                )}
                <input
                  value={form.phone}
                  onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                  placeholder="Telefono"
                  className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
                  required
                />
                <select
                  value={form.vehicle_type}
                  onChange={(event) => setForm((current) => ({ ...current, vehicle_type: event.target.value as DeliveryVehicleType }))}
                  className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
                >
                  <option value="bicycle">Bicicleta</option>
                  <option value="motorcycle">Moto</option>
                  <option value="car">Auto</option>
                </select>
                <input
                  value={form.dni_number}
                  onChange={(event) => setForm((current) => ({ ...current, dni_number: event.target.value }))}
                  placeholder="DNI"
                  className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
                  required
                />
                <input
                  value={form.emergency_contact_name}
                  onChange={(event) => setForm((current) => ({ ...current, emergency_contact_name: event.target.value }))}
                  placeholder="Contacto de emergencia"
                  className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
                  required
                />
                <input
                  value={form.emergency_contact_phone}
                  onChange={(event) => setForm((current) => ({ ...current, emergency_contact_phone: event.target.value }))}
                  placeholder="Telefono de emergencia"
                  className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
                  required
                />
                <input
                  value={form.license_number}
                  onChange={(event) => setForm((current) => ({ ...current, license_number: event.target.value }))}
                  placeholder="Licencia"
                  className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
                />
                <input
                  value={form.vehicle_plate}
                  onChange={(event) => setForm((current) => ({ ...current, vehicle_plate: event.target.value }))}
                  placeholder="Patente"
                  className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
                />
                <input
                  value={form.insurance_policy}
                  onChange={(event) => setForm((current) => ({ ...current, insurance_policy: event.target.value }))}
                  placeholder="Seguro"
                  className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 md:col-span-2"
                />
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  rows={3}
                  placeholder="Notas"
                  className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 md:col-span-2"
                />
              </div>
              <ImageAssetField
                label="Foto del rider"
                value={form.photo_url}
                onChange={(value) => setForm((current) => ({ ...current, photo_url: value }))}
                folder="riders"
                description="Carga una foto desde el dispositivo o pega una URL."
                previewClassName="h-56 w-full object-contain bg-white p-4"
              />
              {formError ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{formError}</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={savingForm}>
                  {savingForm ? "Guardando..." : editingId === null ? "Crear rider" : "Guardar cambios"}
                </Button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-full bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-700"
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
