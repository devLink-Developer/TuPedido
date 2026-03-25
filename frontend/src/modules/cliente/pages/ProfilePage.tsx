import { useEffect, useState } from "react";
import { EmptyState, LoadingCard, PageHeader } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import { createAddress, deleteAddress, fetchAddresses } from "../../../shared/services/api";
import type { Address } from "../../../shared/types";
import { Button } from "../../../shared/ui/Button";
import { notifyCustomerAddressesChanged } from "../../../shared/utils/customerAddresses";

type AddressFormState = {
  label: string;
  street: string;
  details: string;
  latitude: string;
  longitude: string;
  is_default: boolean;
};

const emptyAddressForm: AddressFormState = {
  label: "",
  street: "",
  details: "",
  latitude: "",
  longitude: "",
  is_default: false
};

function toNullableNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function ProfilePage() {
  const { token, user } = useAuthSession();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [form, setForm] = useState<AddressFormState>(emptyAddressForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const items = await fetchAddresses(token);
      setAddresses(items);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo cargar tu perfil");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  async function handleCreateAddress() {
    if (!token) return;
    if (!form.label.trim() || !form.street.trim() || !form.details.trim()) {
      setError("Completa etiqueta, calle y detalle de la direccion.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await createAddress(token, {
        label: form.label.trim(),
        street: form.street.trim(),
        details: form.details.trim(),
        latitude: toNullableNumber(form.latitude),
        longitude: toNullableNumber(form.longitude),
        is_default: form.is_default
      });
      setForm(emptyAddressForm);
      await load();
      notifyCustomerAddressesChanged();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo guardar la direccion");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAddress(addressId: number) {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await deleteAddress(token, addressId);
      await load();
      notifyCustomerAddressesChanged();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo eliminar la direccion");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingCard />;
  if (!user) return <EmptyState title="Perfil no disponible" description="Inicia sesion para ver tu cuenta." />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cliente"
        title="Mi perfil"
        description="Revisa tu cuenta y deja listas tus direcciones para acelerar futuros checkouts."
      />

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="space-y-4">
          <article className="rounded-[28px] bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Cuenta</p>
            <h2 className="mt-2 text-2xl font-bold text-ink">{user.full_name}</h2>
            <p className="mt-2 text-sm text-zinc-600">{user.email}</p>
            <div className="mt-4 rounded-[24px] bg-zinc-50 p-4 text-sm text-zinc-600">
              <p className="font-semibold text-ink">Estado de sesion</p>
              <p className="mt-2">Tu cuenta esta lista para comprar, guardar direcciones y seguir pedidos.</p>
            </div>
          </article>

          <article className="rounded-[28px] bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Nueva direccion</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input
                value={form.label}
                onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
                placeholder="Casa, trabajo, consultorio"
                className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
              />
              <input
                value={form.street}
                onChange={(event) => setForm((current) => ({ ...current, street: event.target.value }))}
                placeholder="Calle y numero"
                className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
              />
              <textarea
                value={form.details}
                onChange={(event) => setForm((current) => ({ ...current, details: event.target.value }))}
                rows={4}
                placeholder="Piso, depto, referencia, timbre"
                className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 md:col-span-2"
              />
              <input
                value={form.latitude}
                onChange={(event) => setForm((current) => ({ ...current, latitude: event.target.value }))}
                placeholder="Latitud opcional"
                className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
              />
              <input
                value={form.longitude}
                onChange={(event) => setForm((current) => ({ ...current, longitude: event.target.value }))}
                placeholder="Longitud opcional"
                className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
              />
              <label className="flex items-center gap-2 rounded-2xl bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700 md:col-span-2">
                <input
                  type="checkbox"
                  checked={form.is_default}
                  onChange={(event) => setForm((current) => ({ ...current, is_default: event.target.checked }))}
                />
                Usar como direccion predeterminada
              </label>
            </div>

            {error ? <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

            <Button type="button" onClick={() => void handleCreateAddress()} disabled={saving} className="mt-4 w-full">
              {saving ? "Guardando..." : "Guardar direccion"}
            </Button>
          </article>
        </section>

        <section className="space-y-4">
          <article className="rounded-[28px] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Direcciones</p>
                <h2 className="mt-2 text-2xl font-bold text-ink">Guardadas para checkout</h2>
              </div>
              <span className="rounded-full bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-600">
                {addresses.length} registradas
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {addresses.map((address) => (
                <article key={address.id} className="rounded-[24px] border border-black/5 bg-zinc-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-ink">{address.label}</h3>
                        {address.is_default ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                            Predeterminada
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm text-zinc-700">{address.street}</p>
                      <p className="mt-1 text-sm text-zinc-500">{address.details}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDeleteAddress(address.id)}
                      className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-rose-700 shadow-sm"
                    >
                      Eliminar
                    </button>
                  </div>
                </article>
              ))}

              {!addresses.length ? (
                <EmptyState
                  title="Aun no tienes direcciones"
                  description="Guarda al menos una direccion para no cargarla de nuevo en cada compra."
                />
              ) : null}
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}
