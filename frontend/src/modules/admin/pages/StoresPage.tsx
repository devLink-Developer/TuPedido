import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "../../../shared/ui/Button";
import { EmptyState, ImageAssetField, LoadingCard, PageHeader } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import {
  createAdminStore,
  fetchAdminApplications,
  fetchAdminCategories,
  fetchAdminStores,
  reviewMerchantApplication,
  updateAdminStoreStatus
} from "../../../shared/services/api";
import type { Category, MerchantApplication, StoreSummary } from "../../../shared/types";
import { hexToRgba, resolveCategoryPalette } from "../../../shared/utils/categoryTheme";
import { statusLabels } from "../../../shared/utils/labels";

type StoreFormState = {
  full_name: string;
  email: string;
  password: string;
  business_name: string;
  description: string;
  address: string;
  phone: string;
  logo_url: string;
  cover_image_url: string;
  review_notes: string;
  category_ids: number[];
};

const emptyStoreForm: StoreFormState = {
  full_name: "",
  email: "",
  password: "",
  business_name: "",
  description: "",
  address: "",
  phone: "",
  logo_url: "",
  cover_image_url: "",
  review_notes: "",
  category_ids: []
};

const resolvedApplicationStatuses = new Set(["approved", "rejected", "suspended"]);

export function StoresPage() {
  const { token } = useAuthSession();
  const [applications, setApplications] = useState<MerchantApplication[]>([]);
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<StoreFormState>(emptyStoreForm);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const [applicationsResult, storesResult, categoriesResult] = await Promise.all([
        fetchAdminApplications(token),
        fetchAdminStores(token),
        fetchAdminCategories(token)
      ]);
      setApplications(applicationsResult);
      setStores(storesResult);
      setCategories(categoriesResult);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo cargar comercios");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  const selectedCategoryIds = useMemo(() => new Set(form.category_ids), [form.category_ids]);
  const selectableCategories = useMemo(() => categories.filter((category) => category.is_active), [categories]);
  const pendingApplications = useMemo(
    () => applications.filter((application) => !resolvedApplicationStatuses.has(application.status)),
    [applications]
  );

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    setCreating(true);
    setCreateError(null);
    try {
      await createAdminStore(token, {
        full_name: form.full_name,
        email: form.email,
        password: form.password,
        business_name: form.business_name,
        description: form.description,
        address: form.address,
        phone: form.phone,
        logo_url: form.logo_url || null,
        cover_image_url: form.cover_image_url || null,
        review_notes: form.review_notes || null,
        category_ids: form.category_ids
      });
      setForm(emptyStoreForm);
      setFormOpen(false);
      await load();
    } catch (requestError) {
      setCreateError(requestError instanceof Error ? requestError.message : "No se pudo crear el comercio");
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <LoadingCard />;
  if (error) return <EmptyState title="Comercios no disponibles" description={error} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Comercios"
        description="Gestiona solicitudes, altas directas y comercios activos desde un solo lugar."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setCreateError(null);
                setForm(emptyStoreForm);
                setFormOpen(true);
              }}
              className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white"
            >
              Agregar comercio
            </button>
            <button type="button" onClick={() => void load()} className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white">
              Actualizar
            </button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Solicitudes pendientes</h2>
          {pendingApplications.map((application) => (
            <article key={application.id} className="rounded-[28px] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">{application.business_name}</h3>
                  <p className="text-sm text-zinc-600">{application.address}</p>
                </div>
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
                  {statusLabels[application.status] ?? application.status}
                </span>
              </div>
              <p className="mt-3 text-sm text-zinc-600">{application.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["approved", "rejected", "suspended"] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={async () => {
                      if (!token) return;
                      await reviewMerchantApplication(token, application.id, { status });
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
            <EmptyState
              title="Sin solicitudes pendientes"
              description="No hay nuevas solicitudes de comercio para revisar."
              action={
                <button type="button" onClick={() => void load()} className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white">
                  Actualizar listado
                </button>
              }
            />
          ) : null}
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-bold">Comercios activos</h2>
          {stores.map((store) => (
            <article key={store.id} className="rounded-[28px] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">{store.name}</h3>
                  <p className="text-sm text-zinc-600">{store.address}</p>
                </div>
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
                  {statusLabels[store.status] ?? store.status}
                </span>
              </div>
              <p className="mt-3 text-sm text-zinc-600">{store.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["approved", "rejected", "suspended"] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={async () => {
                      if (!token) return;
                      await updateAdminStoreStatus(token, store.id, { status });
                      await load();
                    }}
                    className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white"
                  >
                    {statusLabels[status] ?? status}
                  </button>
                ))}
              </div>
            </article>
          ))}
          {!stores.length ? <EmptyState title="Sin comercios" description="Todavia no hay comercios activos." /> : null}
        </div>
      </div>

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-[rgba(17,24,39,0.48)] p-4 md:items-center">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[32px] bg-[linear-gradient(180deg,#fcf6ef_0%,#fffdfa_100%)] p-3 shadow-[0_32px_80px_rgba(24,19,18,0.28)] md:p-5">
            <div className="mb-4 flex items-center justify-between gap-3 px-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Alta directa</p>
                <h2 className="mt-2 text-2xl font-bold text-ink">Crear comercio desde admin</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFormOpen(false);
                  setCreateError(null);
                }}
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={(event) => void handleCreate(event)} className="grid gap-4 rounded-[28px] bg-white p-5 shadow-sm lg:grid-cols-2">
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
                placeholder="Contrasena inicial"
                className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
                minLength={6}
                required
              />
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
                className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
                required
              />
              <div className="grid gap-4 md:grid-cols-2 lg:col-span-2">
                <ImageAssetField
                  label="Logo"
                  value={form.logo_url}
                  onChange={(value) => setForm((current) => ({ ...current, logo_url: value }))}
                  folder="stores"
                  description="Puedes pegar una URL o subirla desde el dispositivo."
                  previewClassName="h-40 w-full object-contain bg-white p-5"
                />
                <ImageAssetField
                  label="Portada"
                  value={form.cover_image_url}
                  onChange={(value) => setForm((current) => ({ ...current, cover_image_url: value }))}
                  folder="stores"
                  description="Imagen principal del comercio."
                />
              </div>
              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Descripcion del comercio"
                rows={4}
                className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 lg:col-span-2"
                required
              />
              <textarea
                value={form.review_notes}
                onChange={(event) => setForm((current) => ({ ...current, review_notes: event.target.value }))}
                placeholder="Nota interna opcional"
                rows={3}
                className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 lg:col-span-2"
              />

              <div className="space-y-3 lg:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Categorias</p>
                <div className="flex flex-wrap gap-2">
                  {selectableCategories.map((category) => {
                    const selected = selectedCategoryIds.has(category.id);
                    const palette = resolveCategoryPalette(category);
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            category_ids: selectedCategoryIds.has(category.id)
                              ? current.category_ids.filter((value) => value !== category.id)
                              : [...current.category_ids, category.id]
                          }))
                        }
                        className="rounded-full border px-4 py-2 text-sm font-semibold transition"
                        style={{
                          backgroundColor: selected ? palette.color : palette.colorLight,
                          borderColor: hexToRgba(palette.color, selected ? 0.22 : 0.14),
                          color: selected ? "#FFF8F0" : palette.color
                        }}
                      >
                        {category.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {createError ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 lg:col-span-2">{createError}</p> : null}

              <div className="flex flex-wrap gap-2 lg:col-span-2">
                <Button type="submit" disabled={creating}>
                  {creating ? "Creando..." : "Crear comercio"}
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setFormOpen(false);
                    setCreateError(null);
                  }}
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
