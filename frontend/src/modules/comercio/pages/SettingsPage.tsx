import { useEffect, useState, type FormEvent } from "react";
import { EmptyState, LoadingCard, PageHeader } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import {
  fetchCategories,
  fetchMerchantStore,
  updateMerchantDeliverySettings,
  updateMerchantPaymentSettings,
  updateMerchantStore,
  updateMerchantStoreCategories
} from "../../../shared/services/api";
import type { Category, MerchantStore } from "../../../shared/types";
import { Button } from "../../../shared/ui/Button";

export function SettingsPage() {
  const { token } = useAuthSession();
  const [store, setStore] = useState<MerchantStore | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [storeResult, categoryResult] = await Promise.all([fetchMerchantStore(token), fetchCategories()]);
      setStore(storeResult);
      setCategories(categoryResult);
      setSelectedCategoryIds(storeResult.category_ids ?? []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo cargar la configuración");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !store) return;
    setSaving(true);
    setError(null);
    try {
      await updateMerchantStore(token, {
        name: store.name,
        description: store.description,
        address: store.address,
        phone: store.phone,
        latitude: store.latitude,
        longitude: store.longitude,
        logo_url: store.logo_url,
        cover_image_url: store.cover_image_url,
        accepting_orders: store.accepting_orders,
        opening_note: store.opening_note,
        min_delivery_minutes: store.min_delivery_minutes,
        max_delivery_minutes: store.max_delivery_minutes
      });
      await updateMerchantStoreCategories(token, { category_ids: selectedCategoryIds });
      await updateMerchantDeliverySettings(token, store.delivery_settings);
      await updateMerchantPaymentSettings(token, {
        cash_enabled: store.payment_settings.cash_enabled,
        mercadopago_enabled: store.payment_settings.mercadopago_enabled
      });
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo guardar la configuración");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingCard />;
  if (error || !store) return <EmptyState title="Configuración no disponible" description={error ?? "Faltan datos del comercio"} />;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Comercio" title="Configuración" description="Datos base, categorías y switches operativos del comercio." />
      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4 rounded-[28px] bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2">
          <input value={store.name} onChange={(event) => setStore((current) => current ? { ...current, name: event.target.value } : current)} placeholder="Nombre" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
          <input value={store.phone} onChange={(event) => setStore((current) => current ? { ...current, phone: event.target.value } : current)} placeholder="Teléfono" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
          <input value={store.address} onChange={(event) => setStore((current) => current ? { ...current, address: event.target.value } : current)} placeholder="Dirección" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 md:col-span-2" />
          <textarea value={store.description} onChange={(event) => setStore((current) => current ? { ...current, description: event.target.value } : current)} rows={4} placeholder="Descripción" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 md:col-span-2" />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-2 rounded-2xl bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700">
            <input type="checkbox" checked={store.accepting_orders} onChange={(event) => setStore((current) => current ? { ...current, accepting_orders: event.target.checked } : current)} />
            Recibir pedidos
          </label>
          <label className="flex items-center gap-2 rounded-2xl bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700">
            <input type="checkbox" checked={store.delivery_settings.delivery_enabled} onChange={(event) => setStore((current) => current ? { ...current, delivery_settings: { ...current.delivery_settings, delivery_enabled: event.target.checked } } : current)} />
            Delivery habilitado
          </label>
          <label className="flex items-center gap-2 rounded-2xl bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700">
            <input type="checkbox" checked={store.delivery_settings.pickup_enabled} onChange={(event) => setStore((current) => current ? { ...current, delivery_settings: { ...current.delivery_settings, pickup_enabled: event.target.checked } } : current)} />
            Retiro habilitado
          </label>
          <label className="flex items-center gap-2 rounded-2xl bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700">
            <input type="checkbox" checked={store.payment_settings.cash_enabled} onChange={(event) => setStore((current) => current ? { ...current, payment_settings: { ...current.payment_settings, cash_enabled: event.target.checked } } : current)} />
            Efectivo
          </label>
          <label className="flex items-center gap-2 rounded-2xl bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700">
            <input type="checkbox" checked={store.payment_settings.mercadopago_enabled} onChange={(event) => setStore((current) => current ? { ...current, payment_settings: { ...current.payment_settings, mercadopago_enabled: event.target.checked } } : current)} />
            Mercado Pago
          </label>
        </div>
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">Categorías</p>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() =>
                  setSelectedCategoryIds((current) =>
                    current.includes(category.id) ? current.filter((id) => id !== category.id) : [...current, category.id]
                  )
                }
                className={`rounded-full px-4 py-2 text-sm font-semibold ${selectedCategoryIds.includes(category.id) ? "bg-brand-500 text-white" : "bg-zinc-100 text-zinc-700"}`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
        <Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar cambios"}</Button>
      </form>
    </div>
  );
}
