import { useEffect, useMemo, useState, type FormEvent } from "react";
import { EmptyState, LoadingCard, PageHeader, StatusPill } from "../../../shared/components";
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

const storeStatusMessages: Record<string, string> = {
  pending_review:
    "Tu solicitud esta en revision. Ya puedes preparar catalogo, pagos e imagenes, pero el local seguira cerrado hasta la aprobacion.",
  approved: "Tu comercio ya puede operar normalmente. Activa la recepcion de pedidos cuando estes listo.",
  rejected: "La solicitud fue rechazada. Revisa tus datos y actualiza la configuracion antes de volver a solicitar aprobacion.",
  suspended: "Tu operacion esta suspendida temporalmente. Puedes revisar la configuracion, pero no recibir pedidos."
};

function toNumber(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function SettingsPage() {
  const { token } = useAuthSession();
  const [store, setStore] = useState<MerchantStore | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isApproved = store?.status === "approved";
  const canToggleOrders = isApproved;
  const statusMessage = useMemo(() => {
    if (!store) return "";
    return storeStatusMessages[store.status] ?? "Actualiza la informacion de tu negocio y mantente listo para operar.";
  }, [store]);

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
      setError(requestError instanceof Error ? requestError.message : "No se pudo cargar la configuracion");
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
    setError(null);
    if (!selectedCategoryIds.length) {
      setError("Selecciona al menos un rubro para tu comercio.");
      return;
    }
    if (store.max_delivery_minutes < store.min_delivery_minutes) {
      setError("El tiempo maximo de entrega debe ser mayor o igual al minimo.");
      return;
    }
    setSaving(true);
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
        accepting_orders: canToggleOrders ? store.accepting_orders : false,
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
      setError(requestError instanceof Error ? requestError.message : "No se pudo guardar la configuracion");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingCard />;
  if (!store) {
    return <EmptyState title="Configuracion no disponible" description={error ?? "Faltan datos del comercio"} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Comercio"
        title="Configura tu local"
        description="Prepara tu marca, tiempos de entrega y medios de cobro. Si tu alta aun esta en revision, el panel queda listo pero la operacion sigue cerrada."
      />

      <section className="rounded-[28px] border border-black/5 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Estado de alta</p>
            <div className="mt-2">
              <StatusPill value={store.status} />
            </div>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-zinc-600">{statusMessage}</p>
        </div>
      </section>

      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5 rounded-[28px] bg-white p-5 shadow-sm">
        <section className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Datos del local</p>
            <h2 className="mt-2 text-xl font-bold text-ink">Identidad comercial</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={store.name}
              onChange={(event) => setStore((current) => (current ? { ...current, name: event.target.value } : current))}
              placeholder="Nombre del local"
              className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
            />
            <input
              value={store.phone}
              onChange={(event) => setStore((current) => (current ? { ...current, phone: event.target.value } : current))}
              placeholder="Telefono de contacto"
              className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
            />
            <input
              value={store.address}
              onChange={(event) => setStore((current) => (current ? { ...current, address: event.target.value } : current))}
              placeholder="Direccion"
              className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 md:col-span-2"
            />
            <textarea
              value={store.description}
              onChange={(event) =>
                setStore((current) => (current ? { ...current, description: event.target.value } : current))
              }
              rows={4}
              placeholder="Cuenta que hace especial a tu negocio"
              className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 md:col-span-2"
            />
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Imagenes</p>
            <h2 className="mt-2 text-xl font-bold text-ink">Logo y portada</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Tu comercio ya recibe una imagen inicial por rubro. Si quieres personalizarla, carga aqui tus URLs.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={store.logo_url ?? ""}
              onChange={(event) =>
                setStore((current) => (current ? { ...current, logo_url: event.target.value || null } : current))
              }
              placeholder="URL del logo"
              className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
            />
            <input
              value={store.cover_image_url ?? ""}
              onChange={(event) =>
                setStore((current) =>
                  current ? { ...current, cover_image_url: event.target.value || null } : current
                )
              }
              placeholder="URL de la portada"
              className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="overflow-hidden rounded-[24px] border border-black/5 bg-zinc-50">
              <div className="h-40 w-full bg-zinc-100">
                {store.cover_image_url ? (
                  <img src={store.cover_image_url} alt="Vista previa de portada" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="px-4 py-3 text-sm text-zinc-600">Portada visible en la ficha del comercio.</div>
            </div>
            <div className="overflow-hidden rounded-[24px] border border-black/5 bg-zinc-50">
              <div className="flex h-40 items-center justify-center bg-zinc-100 p-5">
                {store.logo_url ? (
                  <img src={store.logo_url} alt="Vista previa de logo" className="h-24 w-24 rounded-[24px] object-cover" />
                ) : null}
              </div>
              <div className="px-4 py-3 text-sm text-zinc-600">Logo usado en listados y encabezados.</div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Operacion</p>
            <h2 className="mt-2 text-xl font-bold text-ink">Entregas, cobros y disponibilidad</h2>
          </div>
          {!isApproved ? (
            <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
              Podras activar "Recibir pedidos" una vez que el equipo apruebe tu comercio.
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            <label
              className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${
                canToggleOrders ? "bg-zinc-50 text-zinc-700" : "bg-zinc-100 text-zinc-400"
              }`}
            >
              <input
                type="checkbox"
                checked={canToggleOrders ? store.accepting_orders : false}
                disabled={!canToggleOrders}
                onChange={(event) =>
                  setStore((current) => (current ? { ...current, accepting_orders: event.target.checked } : current))
                }
              />
              Recibir pedidos
            </label>
            <label className="flex items-center gap-2 rounded-2xl bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700">
              <input
                type="checkbox"
                checked={store.delivery_settings.delivery_enabled}
                onChange={(event) =>
                  setStore((current) =>
                    current
                      ? {
                          ...current,
                          delivery_settings: { ...current.delivery_settings, delivery_enabled: event.target.checked }
                        }
                      : current
                  )
                }
              />
              Delivery habilitado
            </label>
            <label className="flex items-center gap-2 rounded-2xl bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700">
              <input
                type="checkbox"
                checked={store.delivery_settings.pickup_enabled}
                onChange={(event) =>
                  setStore((current) =>
                    current
                      ? {
                          ...current,
                          delivery_settings: { ...current.delivery_settings, pickup_enabled: event.target.checked }
                        }
                      : current
                  )
                }
              />
              Retiro en local
            </label>
            <label className="flex items-center gap-2 rounded-2xl bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700">
              <input
                type="checkbox"
                checked={store.payment_settings.cash_enabled}
                onChange={(event) =>
                  setStore((current) =>
                    current
                      ? {
                          ...current,
                          payment_settings: { ...current.payment_settings, cash_enabled: event.target.checked }
                        }
                      : current
                  )
                }
              />
              Efectivo
            </label>
            <label className="flex items-center gap-2 rounded-2xl bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700">
              <input
                type="checkbox"
                checked={store.payment_settings.mercadopago_enabled}
                onChange={(event) =>
                  setStore((current) =>
                    current
                      ? {
                          ...current,
                          payment_settings: {
                            ...current.payment_settings,
                            mercadopago_enabled: event.target.checked
                          }
                        }
                      : current
                  )
                }
              />
              Mercado Pago
            </label>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Parametros</p>
            <h2 className="mt-2 text-xl font-bold text-ink">Detalle operativo</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={store.opening_note ?? ""}
              onChange={(event) =>
                setStore((current) => (current ? { ...current, opening_note: event.target.value || null } : current))
              }
              placeholder="Nota visible para tus clientes"
              className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 md:col-span-2"
            />
            <label className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
              Minutos minimos de entrega
              <input
                type="number"
                min={0}
                value={store.min_delivery_minutes}
                onChange={(event) =>
                  setStore((current) =>
                    current ? { ...current, min_delivery_minutes: toNumber(event.target.value) } : current
                  )
                }
                className="mt-2 w-full bg-transparent text-base font-semibold text-ink outline-none"
              />
            </label>
            <label className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
              Minutos maximos de entrega
              <input
                type="number"
                min={0}
                value={store.max_delivery_minutes}
                onChange={(event) =>
                  setStore((current) =>
                    current ? { ...current, max_delivery_minutes: toNumber(event.target.value) } : current
                  )
                }
                className="mt-2 w-full bg-transparent text-base font-semibold text-ink outline-none"
              />
            </label>
            <label className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
              Costo de delivery
              <input
                type="number"
                min={0}
                step="0.01"
                value={store.delivery_settings.delivery_fee}
                onChange={(event) =>
                  setStore((current) =>
                    current
                      ? {
                          ...current,
                          delivery_settings: {
                            ...current.delivery_settings,
                            delivery_fee: toNumber(event.target.value)
                          }
                        }
                      : current
                  )
                }
                className="mt-2 w-full bg-transparent text-base font-semibold text-ink outline-none"
              />
            </label>
            <label className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
              Pedido minimo
              <input
                type="number"
                min={0}
                step="0.01"
                value={store.delivery_settings.min_order}
                onChange={(event) =>
                  setStore((current) =>
                    current
                      ? {
                          ...current,
                          delivery_settings: {
                            ...current.delivery_settings,
                            min_order: toNumber(event.target.value)
                          }
                        }
                      : current
                  )
                }
                className="mt-2 w-full bg-transparent text-base font-semibold text-ink outline-none"
              />
            </label>
          </div>
        </section>

        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">Rubros</p>
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
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  selectedCategoryIds.includes(category.id) ? "bg-brand-500 text-white" : "bg-zinc-100 text-zinc-700"
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </section>

        {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-zinc-500">
            Guarda tus cambios cuando quieras. La activacion comercial depende de la aprobacion del equipo.
          </p>
          <Button type="submit" disabled={saving}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </form>
    </div>
  );
}
