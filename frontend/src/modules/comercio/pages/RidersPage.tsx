import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { EmptyState, ImageAssetField, LoadingCard } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import {
  createMerchantRider,
  fetchMerchantRiders,
  updateMerchantRider
} from "../../../shared/services/api";
import type { DeliveryProfile, DeliveryVehicleType, MerchantRiderCreate, MerchantRiderUpdate } from "../../../shared/types";
import { Button } from "../../../shared/ui/Button";
import { HelpTooltip } from "../../../shared/ui/HelpTooltip";
import { formatDateTime } from "../../../shared/utils/format";
import { statusLabels } from "../../../shared/utils/labels";
import { MerchantPageBar } from "../components/MerchantPageBar";

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
  const [form, setForm] = useState<RiderFormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingForm, setSavingForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const activeRiders = useMemo(() => riders.filter((rider) => rider.is_active), [riders]);
  const idleRiders = useMemo(() => riders.filter((rider) => rider.is_active && rider.availability === "idle"), [riders]);
  const busyRiders = useMemo(
    () => riders.filter((rider) => rider.is_active && ["reserved", "delivering", "heading_to_store"].includes(rider.availability)),
    [riders]
  );

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const riderResults = await fetchMerchantRiders(token);
      setRiders(riderResults);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudieron cargar los repartidores");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

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

  if (loading) return <LoadingCard label="Cargando repartidores..." />;
  if (error) return <EmptyState title="Repartidores no disponibles" description={error} />;

  return (
    <div className="space-y-3">
      <MerchantPageBar
        eyebrow="Comercio"
        title={
          <span className="inline-flex items-center gap-3">
            <span>Repartidores</span>
            <HelpTooltip label="Ayuda sobre repartidores">
              Administra tu equipo de reparto, su disponibilidad y sus datos operativos.
            </HelpTooltip>
          </span>
        }
        stats={[
          { label: "Disponibles", value: idleRiders.length, tone: idleRiders.length ? "success" : "neutral" },
          { label: "Ocupados", value: busyRiders.length, tone: busyRiders.length ? "warning" : "neutral" },
          { label: "Activos", value: activeRiders.length }
        ]}
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
            <Button type="button" className="bg-white text-ink shadow-none" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Actualizar
            </Button>
          </div>
        }
      />

      <section className="app-panel rounded p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--kp-accent)]">Equipo</p>
            <div className="mt-2 flex items-center gap-2">
              <h2 className="text-lg font-bold text-ink">Repartidores operativos</h2>
              <HelpTooltip label="Ayuda sobre disponibilidad">
                Revisa disponibilidad, datos administrativos y edita cada perfil desde una sola lista.
              </HelpTooltip>
            </div>
          </div>
        </div>

        {riders.length ? (
          <div className="mt-3 space-y-2">
            {riders.map((rider) => (
              <article key={rider.user_id} className="rounded border border-[var(--kp-stroke)] bg-white/90 p-3">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.25fr)_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-ink">{rider.full_name}</h3>
                      <AvailabilityBadge rider={rider} />
                      <span className="rounded bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600">
                        {rider.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                    <p className="mt-1 text-[13px] text-zinc-600">
                      {rider.phone} | {rider.email}
                    </p>
                  </div>
                  <div className="grid gap-1.5 text-[13px] text-zinc-600 sm:grid-cols-2">
                    <p>Vehiculo: <span className="font-semibold text-ink">{vehicleLabels[rider.vehicle_type]}</span></p>
                    <p>DNI: <span className="font-semibold text-ink">{rider.dni_number}</span></p>
                    <p>Entregas: <span className="font-semibold text-ink">{rider.completed_deliveries}</span></p>
                    <p>
                      Ubicacion:{" "}
                      <span className="font-semibold text-ink">
                        {rider.last_location_at ? formatDateTime(rider.last_location_at) : "Sin datos"}
                      </span>
                    </p>
                    {(rider.license_number || rider.vehicle_plate) ? (
                      <p className="sm:col-span-2">
                        {rider.license_number ? `Licencia: ${rider.license_number}` : ""}
                        {rider.license_number && rider.vehicle_plate ? " | " : ""}
                        {rider.vehicle_plate ? `Patente: ${rider.vehicle_plate}` : ""}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    className="justify-center shadow-none"
                    onClick={() => {
                      setEditingId(rider.user_id);
                      setForm(toForm(rider));
                      setFormOpen(true);
                      setFormError(null);
                    }}
                  >
                    Editar
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
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded bg-[linear-gradient(180deg,#fcf6ef_0%,#fffdfa_100%)] p-3 shadow-[0_32px_80px_rgba(24,19,18,0.28)] md:p-4">
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Repartidores</p>
                <h2 className="mt-2 text-xl font-bold text-ink">{editingId === null ? "Nuevo repartidor" : "Editar repartidor"}</h2>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="kp-soft-action min-h-[40px] px-4 py-2 text-sm"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4 rounded bg-white p-4 shadow-sm">
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
