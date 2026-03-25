import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthSession } from "../../../shared/hooks";
import { createMerchantApplication, fetchMerchantApplications, registerMerchantApplication } from "../../../shared/services/api";
import { useAuthStore, useCategoryStore } from "../../../shared/stores";
import type { MerchantApplication, MerchantApplicationCreate, MerchantApplicationRegister } from "../../../shared/types";
import { EmptyState, LoadingCard, PageHeader, RubroChip, StatusPill } from "../../../shared/components";
import { Button } from "../../../shared/ui/Button";
import { roleToHomePath } from "../../../shared/utils/routing";

type MerchantRegistrationState = MerchantApplicationRegister;

const emptyForm: MerchantRegistrationState = {
  full_name: "",
  email: "",
  password: "",
  business_name: "",
  description: "",
  address: "",
  phone: "",
  requested_category_ids: []
};

function toApplicationDraft(form: MerchantRegistrationState): MerchantApplicationCreate {
  return {
    business_name: form.business_name,
    description: form.description,
    address: form.address,
    phone: form.phone,
    requested_category_ids: form.requested_category_ids
  };
}

export function MerchantRegistrationForm() {
  const { token, user, isAuthenticated, refresh } = useAuthSession();
  const setSession = useAuthStore((state) => state.setSession);
  const categories = useCategoryStore((state) => state.categories);
  const categoryLoading = useCategoryStore((state) => state.loading);
  const loadCategories = useCategoryStore((state) => state.loadCategories);
  const navigate = useNavigate();
  const [applications, setApplications] = useState<MerchantApplication[]>([]);
  const [form, setForm] = useState<MerchantRegistrationState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && user && user.role !== "customer") {
      navigate(roleToHomePath[user.role], { replace: true });
      return;
    }

    let cancelled = false;
    setLoading(true);
    Promise.all([loadCategories(), token && user?.role === "customer" ? fetchMerchantApplications(token) : Promise.resolve([])])
      .then(([, applicationsResult]) => {
        if (cancelled) return;
        setApplications(applicationsResult);
        if (user?.role === "customer") {
          setForm((current) => ({
            ...current,
            full_name: current.full_name || user.full_name,
            email: current.email || user.email
          }));
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "No se pudo preparar la solicitud");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, loadCategories, navigate, token, user]);

  const selectedCategoryIds = useMemo(() => new Set(form.requested_category_ids), [form.requested_category_ids]);

  async function handleSubmit() {
    setError(null);
    if (!form.requested_category_ids.length) {
      setError("Selecciona al menos un rubro para crear la solicitud.");
      return;
    }
    setSaving(true);
    try {
      if (isAuthenticated && token && user?.role === "customer") {
        await createMerchantApplication(token, toApplicationDraft(form));
        const profile = await refresh();
        if (profile?.role === "merchant") {
          navigate(roleToHomePath[profile.role], { replace: true });
          return;
        }
        setError("La solicitud se guardo, pero tu acceso comercial aun no se actualizo. Cierra sesion e ingresa nuevamente.");
        return;
      }

      const auth = await registerMerchantApplication(form);
      setSession(auth);
      navigate(roleToHomePath[auth.user.role], { replace: true });
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "No se pudo completar el alta");
    } finally {
      setSaving(false);
    }
  }

  if (loading || categoryLoading) return <LoadingCard />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Solicitud de comercio"
        title="Completa el alta de tu negocio"
        description="Crea tu acceso, registra tu comercio y empieza a configurar tu panel desde el primer momento."
      />

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <form
          className="grid gap-4 rounded-[30px] bg-white p-5 shadow-sm md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          {isAuthenticated && user?.role === "customer" ? (
            <div className="rounded-[24px] bg-zinc-50 px-4 py-4 md:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Cuenta actual</p>
              <p className="mt-2 text-sm font-semibold text-ink">{user.full_name}</p>
              <p className="mt-1 text-sm text-zinc-600">{user.email}</p>
            </div>
          ) : (
            <>
              <input
                value={form.full_name}
                onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))}
                placeholder="Nombre del responsable"
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
                placeholder="Contrasena"
                className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 md:col-span-2"
                minLength={6}
                required
              />
            </>
          )}

          <input
            value={form.business_name}
            onChange={(event) => setForm((current) => ({ ...current, business_name: event.target.value }))}
            placeholder="Nombre comercial"
            className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
            required
          />
          <input
            value={form.phone}
            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
            placeholder="Telefono"
            className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
            required
          />
          <input
            value={form.address}
            onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
            placeholder="Direccion"
            className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 md:col-span-2"
            required
          />
          <textarea
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            placeholder="Describe tu propuesta comercial"
            rows={5}
            className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 md:col-span-2"
            required
          />

          <div className="space-y-3 md:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">Categorias</p>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => {
                const selected = selectedCategoryIds.has(category.id);
                return (
                  <RubroChip
                    key={category.id}
                    label={category.name}
                    color={category.color}
                    colorLight={category.color_light}
                    icon={category.icon}
                    selected={selected}
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        requested_category_ids: selected
                          ? current.requested_category_ids.filter((id) => id !== category.id)
                          : [...current.requested_category_ids, category.id]
                      }))
                    }
                  />
                );
              })}
            </div>
          </div>

          {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 md:col-span-2">{error}</p> : null}
          <Button type="submit" disabled={saving} className="md:col-span-2">
            {saving
              ? "Guardando..."
              : isAuthenticated && user?.role === "customer"
                ? "Guardar solicitud"
                : "Guardar solicitud y registrarse"}
          </Button>
        </form>

        <div className="space-y-4">
          <div className="rounded-[30px] bg-[linear-gradient(180deg,#221816_0%,#171210_100%)] p-6 text-white shadow-lift">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-200">Tu comercio</p>
            <h3 className="mt-3 font-display text-3xl font-bold tracking-tight">Configura primero, activa despues</h3>
            <div className="mt-4 grid gap-3 text-sm text-white/72">
              <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">Creas tu acceso y entras al panel en el mismo paso.</div>
              <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">Tu rubro define imagenes iniciales para el comercio y luego puedes personalizarlas desde configuracion.</div>
              <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">Podras cargar productos, medios de pago y datos del negocio mientras se revisa la solicitud.</div>
              <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">Tu local no podra recibir pedidos hasta que el equipo apruebe el alta.</div>
            </div>
          </div>

          {applications.length ? (
            <div className="space-y-3">
              {applications.map((application) => (
                <article key={application.id} className="rounded-[28px] bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-lg font-bold">{application.business_name}</h4>
                      <p className="text-sm text-zinc-600">{application.address}</p>
                    </div>
                    <StatusPill value={application.status} />
                  </div>
                  <p className="mt-3 text-sm text-zinc-600">{application.description}</p>
                  {application.review_notes ? (
                    <p className="mt-3 rounded-2xl bg-zinc-50 px-4 py-3 text-sm text-zinc-700">{application.review_notes}</p>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="Listo para comenzar" description="Completa los datos y te llevamos al panel de tu comercio para continuar la configuracion." />
          )}
        </div>
      </div>
    </div>
  );
}
