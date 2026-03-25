import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useCategoryStore } from "../../../shared/stores";
import type { StoreSummary } from "../../../shared/types";
import { hexToRgba, resolveCategoryPalette } from "../../../shared/utils/categoryTheme";
import { formatCurrency } from "../../../shared/utils/format";

function hasMercadoPago(paymentSettings: StoreSummary["payment_settings"]) {
  return paymentSettings.mercadopago_enabled && paymentSettings.mercadopago_configured;
}

export function StoreList({ stores }: { stores: StoreSummary[] }) {
  const categories = useCategoryStore((state) => state.categories);
  const categoriesById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {stores.map((store) => {
        const primaryCategory = store.primary_category_id ? categoriesById.get(store.primary_category_id) : undefined;
        const palette = resolveCategoryPalette(primaryCategory);

        return (
          <Link
            key={store.id}
            to={`/c/tienda/${store.id}`}
            className="group overflow-hidden rounded-[28px] bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div
              className="h-40 bg-gradient-to-br from-ink to-orange-900/90"
              style={
                store.cover_image_url
                  ? {
                      backgroundImage: `linear-gradient(180deg, rgba(24,24,27,0.1), rgba(24,24,27,0.8)), url(${store.cover_image_url})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center"
                    }
                  : undefined
              }
            />
            <div className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-black tracking-tight">{store.name}</h3>
                  <p className="mt-1 text-sm text-zinc-600">{store.address}</p>
                </div>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                  {store.rating.toFixed(1)} ({store.rating_count})
                </span>
              </div>

              <p className="line-clamp-2 text-sm leading-6 text-zinc-600">{store.description}</p>

              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <span className={`rounded-full px-3 py-1 ${store.is_open ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                  {store.is_open ? "Abierto" : "Cerrado"}
                </span>
                {store.primary_category ? (
                  <span
                    className="rounded-full border px-3 py-1"
                    style={{
                      backgroundColor: palette.colorLight,
                      borderColor: hexToRgba(palette.color, 0.14),
                      color: palette.color
                    }}
                  >
                    {store.primary_category}
                  </span>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2 text-xs font-semibold text-zinc-500">
                <span className="rounded-full bg-zinc-100 px-3 py-1">
                  {store.delivery_settings.delivery_enabled
                    ? `Envio ${formatCurrency(store.delivery_settings.delivery_fee)}`
                    : "Solo retiro"}
                </span>
                <span className="rounded-full bg-zinc-100 px-3 py-1">
                  {store.payment_settings.cash_enabled ? "Efectivo" : "Sin efectivo"}
                </span>
                <span className="rounded-full bg-zinc-100 px-3 py-1">
                  {hasMercadoPago(store.payment_settings) ? "Mercado Pago" : "MP no disponible"}
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
