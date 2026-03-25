import { useEffect, useState, type FormEvent } from "react";
import { EmptyState, LoadingCard, PageHeader } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import {
  createAdminCategory,
  createAdminSettlementPayment,
  fetchAdminCategories,
  fetchAdminSettlementStores,
  fetchPlatformSettings,
  updatePlatformSettings
} from "../../../shared/services/api";
import type { AdminSettlementStore, Category, PlatformSettings } from "../../../shared/types";
import { formatCurrency } from "../../../shared/utils/format";
import { Button } from "../../../shared/ui/Button";

export function SettingsPage() {
  const { token } = useAuthSession();
  const [categories, setCategories] = useState<Category[]>([]);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null);
  const [settlementStores, setSettlementStores] = useState<AdminSettlementStore[]>([]);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [serviceFee, setServiceFee] = useState("0");
  const [paymentForm, setPaymentForm] = useState({ store_id: "", amount: "", reference: "", notes: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const [categoryResult, settingsResult, storesResult] = await Promise.all([
        fetchAdminCategories(token),
        fetchPlatformSettings(token),
        fetchAdminSettlementStores(token)
      ]);
      setCategories(categoryResult);
      setPlatformSettings(settingsResult);
      setServiceFee(settingsResult.service_fee_amount.toFixed(2));
      setSettlementStores(storesResult);
      setPaymentForm((current) => ({ ...current, store_id: current.store_id || String(storesResult[0]?.id ?? "") }));
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo cargar configuración admin");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  async function handleCategoryCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setSaving(true);
    await createAdminCategory(token, { name: categoryName, description: categoryDescription || null });
    setCategoryName("");
    setCategoryDescription("");
    setSaving(false);
    await load();
  }

  async function handleServiceFeeSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setSaving(true);
    await updatePlatformSettings(token, { service_fee_amount: Number(serviceFee) || 0 });
    setSaving(false);
    await load();
  }

  async function handlePaymentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setSaving(true);
    await createAdminSettlementPayment(token, {
      store_id: Number(paymentForm.store_id),
      amount: Number(paymentForm.amount),
      reference: paymentForm.reference || null,
      notes: paymentForm.notes || null
    });
    setPaymentForm((current) => ({ ...current, amount: "", reference: "", notes: "" }));
    setSaving(false);
    await load();
  }

  if (loading) return <LoadingCard />;
  if (error || !platformSettings) return <EmptyState title="Configuración no disponible" description={error ?? "Sin datos"} />;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Admin" title="Configuración" description="Categorías, fee global y pagos manuales de settlement." />
      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={(event) => void handleCategoryCreate(event)} className="rounded-[28px] bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold">Nueva categoría</h3>
          <div className="mt-4 grid gap-3">
            <input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Farmacias" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
            <input value={categoryDescription} onChange={(event) => setCategoryDescription(event.target.value)} placeholder="Salud y cuidado" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
            <Button type="submit" disabled={saving}>Crear</Button>
          </div>
          <div className="mt-4 space-y-2">
            {categories.map((category) => (
              <div key={category.id} className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                <p className="font-semibold">{category.name}</p>
                <p className="text-zinc-500">{category.slug}</p>
              </div>
            ))}
          </div>
        </form>

        <form onSubmit={(event) => void handleServiceFeeSave(event)} className="rounded-[28px] bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold">Servicio global</h3>
          <p className="mt-2 text-sm text-zinc-600">Valor actual: {formatCurrency(platformSettings.service_fee_amount)}</p>
          <div className="mt-4 grid gap-3">
            <input type="number" min="0" step="0.01" value={serviceFee} onChange={(event) => setServiceFee(event.target.value)} className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
            <Button type="submit" disabled={saving}>Guardar</Button>
          </div>
        </form>
      </div>

      <form onSubmit={(event) => void handlePaymentSubmit(event)} className="rounded-[28px] bg-white p-5 shadow-sm">
        <h3 className="text-lg font-bold">Pago manual a comercio</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <select value={paymentForm.store_id} onChange={(event) => setPaymentForm((current) => ({ ...current, store_id: event.target.value }))} className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3">
            {settlementStores.map((store) => <option key={store.id} value={store.id}>{store.store_name}</option>)}
          </select>
          <input type="number" min="0" step="0.01" value={paymentForm.amount} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} placeholder="Monto" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
          <input value={paymentForm.reference} onChange={(event) => setPaymentForm((current) => ({ ...current, reference: event.target.value }))} placeholder="Referencia" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
          <input value={paymentForm.notes} onChange={(event) => setPaymentForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Notas" className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3" />
        </div>
        <Button type="submit" disabled={saving} className="mt-4">{saving ? "Guardando..." : "Registrar pago"}</Button>
      </form>
    </div>
  );
}
