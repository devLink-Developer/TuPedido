import { useEffect, useState } from "react";
import { EmptyState, LoadingCard, PageHeader } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import { createAddress, deleteAddress, fetchAddresses, updateAddress } from "../../../shared/services/api";
import type { Address } from "../../../shared/types";
import { notifyCustomerAddressesChanged } from "../../../shared/utils/customerAddresses";
import {
  AddressFormCard,
  emptyAddressForm,
  getAddressMissingFields,
  hasAddressGeolocation,
  toAddressFormState,
  toAddressPayload,
  type AddressFormState,
} from "../components/AddressFormCard";

function formatMissingAddressFields(fields: string[]) {
  if (!fields.length) {
    return "";
  }

  if (fields.length === 1) {
    return fields[0];
  }

  return `${fields.slice(0, -1).join(", ")} y ${fields[fields.length - 1]}`;
}

export function ProfilePage() {
  const { token, user } = useAuthSession();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [form, setForm] = useState<AddressFormState>(emptyAddressForm);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<number | null>(null);
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

  async function handleSaveAddress(nextForm: AddressFormState) {
    if (!token) return;
    const missingFields = getAddressMissingFields(nextForm);
    if (missingFields.length) {
      setError(`Completa ${formatMissingAddressFields(missingFields)}.`);
      return;
    }
    if (!hasAddressGeolocation(nextForm)) {
      setError("No pudimos ubicar la direccion todavia. Revisa calle y altura o ajusta el pin en el mapa.");
      return;
    }

    const payload = toAddressPayload(nextForm);
    if (!payload) {
      setError("No se pudo leer la geolocalizacion seleccionada.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (editingAddressId) {
        await updateAddress(token, editingAddressId, payload);
      } else {
        await createAddress(token, payload);
      }
      setForm(emptyAddressForm);
      setEditingAddressId(null);
      setShowAddressForm(false);
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
      if (editingAddressId === addressId) {
        setEditingAddressId(null);
        setForm(emptyAddressForm);
        setShowAddressForm(false);
      }
      await load();
      notifyCustomerAddressesChanged();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo eliminar la direccion");
    } finally {
      setSaving(false);
    }
  }

  function handleStartEdit(address: Address) {
    setEditingAddressId(address.id);
    setForm(toAddressFormState(address));
    setShowAddressForm(true);
    setError(null);
  }

  function handleStartCreate() {
    setEditingAddressId(null);
    setForm(emptyAddressForm);
    setShowAddressForm(true);
    setError(null);
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

          {!showAddressForm ? (
            <button
              type="button"
              onClick={handleStartCreate}
              className="w-full rounded-full bg-brand-500 px-5 py-3 text-sm font-semibold text-white shadow-sm"
            >
              Nueva direccion
            </button>
          ) : (
            <AddressFormCard
              title={editingAddressId ? "Editar direccion" : "Nueva direccion"}
              submitLabel={editingAddressId ? "Guardar cambios" : "Guardar direccion"}
              lookupToken={token}
              form={form}
              saving={saving}
              error={error}
              onChange={(value) => {
                setForm(value);
                setError(null);
              }}
              onSubmit={handleSaveAddress}
              onCancel={() => {
                setEditingAddressId(null);
                setForm(emptyAddressForm);
                setShowAddressForm(false);
                setError(null);
              }}
            />
          )}
        </section>

        <section className="space-y-4">
          <article className="rounded-[28px] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Direcciones de envio</p>
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
                      {address.locality || address.province || address.postal_code ? (
                        <p className="mt-1 text-sm text-zinc-500">
                          {[address.locality, address.province, address.postal_code].filter(Boolean).join(" - ")}
                        </p>
                      ) : null}
                      {address.details ? <p className="mt-1 text-sm text-zinc-500">{address.details}</p> : null}
                      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                        {address.latitude !== null && address.longitude !== null ? "Geolocalizacion lista" : "Falta geolocalizacion"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(address)}
                        className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteAddress(address.id)}
                        className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-rose-700 shadow-sm"
                      >
                        Eliminar
                      </button>
                    </div>
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
