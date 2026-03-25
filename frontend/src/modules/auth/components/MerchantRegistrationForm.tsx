import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthSession } from "../../../shared/hooks";
import { createMerchantApplication, fetchCategories, fetchMerchantApplications } from "../../../shared/services/api";
import { useUiStore } from "../../../shared/stores";
import type { Category, MerchantApplication, MerchantApplicationCreate } from "../../../shared/types";
import { EmptyState, LoadingCard, PageHeader, StatusPill } from "../../../shared/components";
import { Button } from "../../../shared/ui/Button";
import { roleToHomePath } from "../../../shared/utils/routing";

type MerchantDraft = MerchantApplicationCreate;

const emptyDraft: MerchantDraft = {
  business_name: "",
  description: "",
  address: "",
  phone: "",
  logo_url: "",
  cover_image_url: "",
  requested_category_ids: []
};

export function MerchantRegistrationForm() {
  const { token, user, isAuthenticated } = useAuthSession();
  const navigate = useNavigate();
  const saveDraft = useUiStore((state) => state.saveApplicationDraft);
  const clearDraft = useUiStore((state) => state.clearApplicationDraft);
  const getDraft = useUiStore((state) => state.getApplicationDraft);
  const [categories, setCategories] = useState<Category[]>([]);
  const [applications, setApplications] = useState<MerchantApplication[]>([]);
  const [form, setForm] = useState<MerchantDraft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoSubmitRef = useRef(false);

  useEffect(() => {
    const saved = getDraft("merchant");
    if (saved?.draft) {
      setForm(saved.draft as MerchantDraft);
    }
  }, [getDraft]);

  useEffect(() => {
    if (isAuthenticated && user && user.role !== "customer") {
      navigate(roleToHomePath[user.role], { replace: true });
      return;
    }

    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchCategories(),
      token && user?.role === "customer" ? fetchMerchantApplications(token) : Promise.resolve([])
    ])
      .then(([categoriesResult, applicationsResult]) => {
        if (cancelled) return;
        setCategories(categoriesResult);
        setApplications(applicationsResult);
      })
      .catch((requestError) => {
        if (cancelled) return;
        setError(requestError instanceof Error ? requestError.message : "No se pudo preparar la postulación");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, navigate, token, user]);

  const savedDraft = getDraft("merchant");

  async function submitCurrentForm(currentForm: MerchantDraft) {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const application = await createMerchantApplication(token, {
        ...currentForm,
        logo_url: currentForm.logo_url || null,
        cover_image_url: currentForm.cover_image_url || null
      });
      clearDraft("merchant");
      setApplications((current) => [application, ...current]);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "No se pudo enviar la postulación"
      );
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!isAuthenticated || !token || !savedDraft?.pendingSubmit || autoSubmitRef.current) return;
    autoSubmitRef.current = true;
    void submitCurrentForm(savedDraft.draft as MerchantDraft);
  }, [isAuthenticated, savedDraft, token]);

  const selectedCategoryIds = useMemo(() => new Set(form.requested_category_ids), [form.requested_category_ids]);

  if (loading) return <LoadingCard />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Postulación comercio"
        title="Completa tu alta comercial"
        description="El formulario es público. Si todavía no tienes sesión, el draft se guarda y se reanuda después del login."
      />

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <form
          className="grid gap-4 rounded-[30px] bg-white p-5 shadow-sm md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!isAuthenticated) {
              saveDraft("merchant", form, "/registro-comercio", true);
              navigate("/registro?redirectTo=/registro-comercio");
              return;
            }
            void submitCurrentForm(form);
          }}
        >
          <input value={form.business_name} onChange={(event) => setForm((current) => ({ ...current, business_name: event.target.value }))} placeholder="Nombre comercial" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" required />
          <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Teléfono" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" required />
          <input value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} placeholder="Dirección" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 md:col-span-2" required />
          <input value={form.logo_url ?? ""} onChange={(event) => setForm((current) => ({ ...current, logo_url: event.target.value }))} placeholder="Logo URL" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
          <input value={form.cover_image_url ?? ""} onChange={(event) => setForm((current) => ({ ...current, cover_image_url: event.target.value }))} placeholder="Portada URL" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
          <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Describe tu propuesta comercial" rows={5} className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 md:col-span-2" required />

          <div className="space-y-3 md:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">Categorías</p>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      requested_category_ids: selectedCategoryIds.has(category.id)
                        ? current.requested_category_ids.filter((id) => id !== category.id)
                        : [...current.requested_category_ids, category.id]
                    }))
                  }
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${selectedCategoryIds.has(category.id) ? "bg-brand-500 text-white" : "bg-zinc-100 text-zinc-700"}`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 md:col-span-2">{error}</p> : null}
          <Button type="submit" disabled={saving} className="md:col-span-2">
            {saving ? "Enviando..." : isAuthenticated ? "Enviar postulación" : "Guardar draft y continuar"}
          </Button>
        </form>

        <div className="space-y-4">
          <div className="rounded-[30px] bg-[linear-gradient(180deg,#221816_0%,#171210_100%)] p-6 text-white shadow-lift">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-200">Flujo</p>
            <h3 className="mt-3 font-display text-3xl font-bold tracking-tight">Onboarding público con reanudación</h3>
            <div className="mt-4 grid gap-3 text-sm text-white/72">
              <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">El formulario puede completarse sin estar autenticado.</div>
              <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">Al enviar, el draft se guarda y la sesión se resuelve en /login o /registro.</div>
              <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">Al volver, la postulación se ejecuta con el endpoint autenticado actual.</div>
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
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="Sin postulaciones todavía" description="Cuando envíes la solicitud verás aquí el estado de revisión." />
          )}
        </div>
      </div>
    </div>
  );
}
