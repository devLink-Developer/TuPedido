import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthSession } from "../../../shared/hooks";
import { createDeliveryApplication, fetchDeliveryApplications } from "../../../shared/services/api";
import { useUiStore } from "../../../shared/stores";
import type { DeliveryApplication, DeliveryApplicationCreate } from "../../../shared/types";
import { EmptyState, LoadingCard, PageHeader, StatusPill } from "../../../shared/components";
import { Button } from "../../../shared/ui/Button";
import { roleToHomePath } from "../../../shared/utils/routing";

type RiderDraft = DeliveryApplicationCreate;

const emptyDraft: RiderDraft = {
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

export function RiderRegistrationForm() {
  const { token, user, isAuthenticated } = useAuthSession();
  const navigate = useNavigate();
  const saveDraft = useUiStore((state) => state.saveApplicationDraft);
  const clearDraft = useUiStore((state) => state.clearApplicationDraft);
  const getDraft = useUiStore((state) => state.getApplicationDraft);
  const [form, setForm] = useState<RiderDraft>(emptyDraft);
  const [applications, setApplications] = useState<DeliveryApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoSubmitRef = useRef(false);

  useEffect(() => {
    const saved = getDraft("delivery");
    if (saved?.draft) {
      setForm(saved.draft as RiderDraft);
    }
  }, [getDraft]);

  useEffect(() => {
    if (isAuthenticated && user && user.role !== "customer") {
      navigate(roleToHomePath[user.role], { replace: true });
      return;
    }

    let cancelled = false;
    setLoading(true);
    (token ? fetchDeliveryApplications(token) : Promise.resolve([]))
      .then((applicationList) => {
        if (!cancelled) setApplications(applicationList);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "No se pudo preparar la postulación");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, navigate, token, user]);

  const savedDraft = getDraft("delivery");

  async function submitCurrentForm(currentForm: RiderDraft) {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const application = await createDeliveryApplication(token, {
        ...currentForm,
        photo_url: currentForm.photo_url || null,
        license_number: currentForm.license_number || null,
        vehicle_plate: currentForm.vehicle_plate || null,
        insurance_policy: currentForm.insurance_policy || null,
        notes: currentForm.notes || null
      });
      clearDraft("delivery");
      setApplications((current) => [application, ...current]);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "No se pudo enviar la solicitud");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!isAuthenticated || !token || !savedDraft?.pendingSubmit || autoSubmitRef.current) return;
    autoSubmitRef.current = true;
    void submitCurrentForm(savedDraft.draft as RiderDraft);
  }, [isAuthenticated, savedDraft, token]);

  if (loading) return <LoadingCard />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Postulación rider"
        title="Completa tu alta operativa"
        description="El formulario es público, pero la postulación real se envía solo cuando ya existe sesión."
      />

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <form
          className="grid gap-4 rounded-[30px] bg-white p-5 shadow-sm md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!isAuthenticated) {
              saveDraft("delivery", form, "/registro-rider", true);
              navigate("/registro?redirectTo=/registro-rider");
              return;
            }
            void submitCurrentForm(form);
          }}
        >
          <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Teléfono" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" required />
          <select value={form.vehicle_type} onChange={(event) => setForm((current) => ({ ...current, vehicle_type: event.target.value as RiderDraft["vehicle_type"] }))} className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3">
            <option value="bicycle">Bicicleta</option>
            <option value="motorcycle">Moto</option>
            <option value="car">Auto</option>
          </select>
          <input value={form.dni_number} onChange={(event) => setForm((current) => ({ ...current, dni_number: event.target.value }))} placeholder="DNI" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" required />
          <input value={form.photo_url ?? ""} onChange={(event) => setForm((current) => ({ ...current, photo_url: event.target.value }))} placeholder="Foto URL opcional" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
          <input value={form.emergency_contact_name} onChange={(event) => setForm((current) => ({ ...current, emergency_contact_name: event.target.value }))} placeholder="Contacto de emergencia" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" required />
          <input value={form.emergency_contact_phone} onChange={(event) => setForm((current) => ({ ...current, emergency_contact_phone: event.target.value }))} placeholder="Teléfono emergencia" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" required />
          <input value={form.license_number ?? ""} onChange={(event) => setForm((current) => ({ ...current, license_number: event.target.value }))} placeholder="Licencia" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
          <input value={form.vehicle_plate ?? ""} onChange={(event) => setForm((current) => ({ ...current, vehicle_plate: event.target.value }))} placeholder="Patente" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
          <input value={form.insurance_policy ?? ""} onChange={(event) => setForm((current) => ({ ...current, insurance_policy: event.target.value }))} placeholder="Seguro" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 md:col-span-2" />
          <textarea value={form.notes ?? ""} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Notas adicionales" rows={4} className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 md:col-span-2" />
          {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 md:col-span-2">{error}</p> : null}
          <Button type="submit" disabled={saving} className="md:col-span-2">
            {saving ? "Enviando..." : isAuthenticated ? "Enviar postulación" : "Guardar draft y continuar"}
          </Button>
        </form>

        <div className="space-y-4">
          <div className="rounded-[30px] bg-[linear-gradient(180deg,#0f1f1b_0%,#132c24_100%)] p-6 text-white shadow-lift">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#9be3c1]/70">Flujo</p>
            <h3 className="mt-3 font-display text-3xl font-bold tracking-tight">Alta pública con validación operativa</h3>
            <div className="mt-4 grid gap-3 text-sm text-white/72">
              <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">Se retoma automáticamente al volver de /login o /registro.</div>
              <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">La operación en /r queda aislada del flujo público.</div>
              <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">El admin revisa esta solicitud desde /a/riders.</div>
            </div>
          </div>

          {applications.length ? (
            <div className="space-y-3">
              {applications.map((application) => (
                <article key={application.id} className="rounded-[28px] bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-lg font-bold">{application.user_name}</h4>
                      <p className="text-sm text-zinc-600">{application.vehicle_type} · {application.phone}</p>
                    </div>
                    <StatusPill value={application.status} />
                  </div>
                  <p className="mt-3 text-sm text-zinc-600">{application.review_notes ?? "Solicitud enviada, pendiente de revisión."}</p>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="Sin postulaciones todavía" description="Cuando envíes la solicitud verás aquí el estado operativo." />
          )}
        </div>
      </div>
    </div>
  );
}
