import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "../../../shared/ui/Button";
import { EmptyState, LoadingCard, PageHeader } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import {
  assignAdminDeliveryOrder,
  createAdminRider,
  fetchAdminDeliveryApplications,
  fetchAdminDeliveryDispatch,
  fetchAdminDeliveryRiders,
  fetchAdminDeliveryZones,
  reviewAdminDeliveryApplication
} from "../../../shared/services/api";
import type { DeliveryApplication, DeliveryProfile, DeliveryVehicleType, DeliveryZone, Order } from "../../../shared/types";
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
  review_notes: string;
  current_zone_id: string;
};

const emptyRiderForm: RiderFormState = {
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
  review_notes: "",
  current_zone_id: ""
};

export function RidersPage() {
  const { token } = useAuthSession();
  const [applications, setApplications] = useState<DeliveryApplication[]>([]);
  const [riders, setRiders] = useState<DeliveryProfile[]>([]);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [dispatchOrders, setDispatchOrders] = useState<Order[]>([]);
  const [form, setForm] = useState<RiderFormState>(emptyRiderForm);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const [applicationsResult, ridersResult, dispatchResult, zonesResult] = await Promise.all([
        fetchAdminDeliveryApplications(token),
        fetchAdminDeliveryRiders(token),
        fetchAdminDeliveryDispatch(token),
        fetchAdminDeliveryZones(token)
      ]);
      setApplications(applicationsResult);
      setRiders(ridersResult);
      setDispatchOrders(dispatchResult);
      setZones(zonesResult);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo cargar riders");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  const pendingApplications = useMemo(
    () => applications.filter((application) => application.status === "pending_review"),
    [applications]
  );

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    setCreating(true);
    setCreateError(null);
    try {
      await createAdminRider(token, {
        full_name: form.full_name,
        email: form.email,
        password: form.password,
        phone: form.phone,
        vehicle_type: form.vehicle_type,
        dni_number: form.dni_number,
        emergency_contact_name: form.emergency_contact_name,
        emergency_contact_phone: form.emergency_contact_phone,
        photo_url: form.photo_url || null,
        license_number: form.license_number || null,
        vehicle_plate: form.vehicle_plate || null,
        insurance_policy: form.insurance_policy || null,
        notes: form.notes || null,
        review_notes: form.review_notes || null,
        current_zone_id: form.current_zone_id ? Number(form.current_zone_id) : null
      });
      setForm(emptyRiderForm);
      await load();
    } catch (requestError) {
      setCreateError(requestError instanceof Error ? requestError.message : "No se pudo crear el rider");
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <LoadingCard />;
  if (error) return <EmptyState title="Riders no disponibles" description={error} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Riders"
        description="Gestiona solicitudes, altas directas y asignaciones operativas."
      />

      <form onSubmit={(event) => void handleCreate(event)} className="grid gap-4 rounded-[28px] bg-white p-5 shadow-sm lg:grid-cols-2">
        <div className="lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Alta directa</p>
          <h2 className="mt-2 text-xl font-bold">Crear rider desde admin</h2>
        </div>

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
        />
        <input
          type="password"
          value={form.password}
          onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
          placeholder="Contrasena inicial"
          className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
          minLength={6}
          required
        />
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
        <select
          value={form.current_zone_id}
          onChange={(event) => setForm((current) => ({ ...current, current_zone_id: event.target.value }))}
          className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
        >
          <option value="">Sin zona inicial</option>
          {zones.map((zone) => (
            <option key={zone.id} value={zone.id}>
              {zone.name}
            </option>
          ))}
        </select>
        <input
          value={form.dni_number}
          onChange={(event) => setForm((current) => ({ ...current, dni_number: event.target.value }))}
          placeholder="DNI"
          className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
          required
        />
        <input
          value={form.photo_url}
          onChange={(event) => setForm((current) => ({ ...current, photo_url: event.target.value }))}
          placeholder="Foto URL"
          className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
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
          className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 lg:col-span-2"
        />
        <textarea
          value={form.notes}
          onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
          placeholder="Notas operativas"
          rows={3}
          className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 lg:col-span-2"
        />
        <textarea
          value={form.review_notes}
          onChange={(event) => setForm((current) => ({ ...current, review_notes: event.target.value }))}
          placeholder="Nota interna opcional"
          rows={3}
          className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 lg:col-span-2"
        />

        {createError ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 lg:col-span-2">{createError}</p> : null}
        <Button type="submit" disabled={creating} className="lg:col-span-2">
          {creating ? "Creando..." : "Crear rider"}
        </Button>
      </form>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Solicitudes pendientes</h2>
          {pendingApplications.map((application) => (
            <article key={application.id} className="rounded-[28px] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">{application.user_name}</h3>
                  <p className="text-sm text-zinc-600">
                    {application.vehicle_type} - {application.phone}
                  </p>
                </div>
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                  {statusLabels[application.status] ?? application.status}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["approved", "rejected", "suspended"] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={async () => {
                      if (!token) return;
                      await reviewAdminDeliveryApplication(token, application.id, { status });
                      await load();
                    }}
                    className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
                  >
                    {statusLabels[status] ?? status}
                  </button>
                ))}
              </div>
            </article>
          ))}
          {!pendingApplications.length ? (
            <EmptyState title="Sin solicitudes pendientes" description="No hay nuevas solicitudes de rider para revisar." />
          ) : null}
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-bold">Riders activos</h2>
          {riders.map((rider) => (
            <article key={rider.user_id} className="rounded-[28px] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">{rider.full_name}</h3>
                  <p className="text-sm text-zinc-600">
                    {rider.vehicle_type} - {rider.phone}
                  </p>
                </div>
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                  {statusLabels[rider.availability] ?? rider.availability}
                </span>
              </div>
            </article>
          ))}
          {!riders.length ? <EmptyState title="Sin riders" description="Todavia no hay riders activos." /> : null}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold">Dispatch</h2>
        {dispatchOrders.map((order) => (
          <article key={order.id} className="rounded-[28px] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">Pedido #{order.id}</h3>
                <p className="text-sm text-zinc-600">
                  {order.store_name} - {order.customer_name}
                </p>
              </div>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                {statusLabels[order.delivery_status] ?? order.delivery_status}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {riders.map((rider) => (
                <button
                  key={rider.user_id}
                  type="button"
                  onClick={async () => {
                    if (!token) return;
                    await assignAdminDeliveryOrder(token, order.id, rider.user_id);
                    await load();
                  }}
                  className="rounded-full bg-brand-500 px-3 py-2 text-xs font-semibold text-white"
                >
                  {rider.full_name}
                </button>
              ))}
            </div>
          </article>
        ))}
        {!dispatchOrders.length ? <EmptyState title="Sin dispatch" description="No hay pedidos esperando asignacion." /> : null}
      </div>
    </div>
  );
}
