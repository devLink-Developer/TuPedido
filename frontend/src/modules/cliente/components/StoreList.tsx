import { useMemo } from "react";
import { Link } from "react-router-dom";
import { RubroChip } from "../../../shared/components";
import { useCategoryStore } from "../../../shared/stores";
import type { StoreSummary } from "../../../shared/types";
import { formatCurrency } from "../../../shared/utils/format";
import { buildCatalogTheme, type CatalogTheme } from "../utils/catalogTheme";

function hasMercadoPago(paymentSettings: StoreSummary["payment_settings"]) {
  return paymentSettings.mercadopago_enabled && paymentSettings.mercadopago_configured;
}

function storeMatchesCategory(store: StoreSummary, categoryId: number | null) {
  if (!categoryId) return false;
  return store.primary_category_id === categoryId || store.category_ids?.includes(categoryId) === true;
}

export function StoreList({
  stores,
  selectedCategoryId,
  theme
}: {
  stores: StoreSummary[];
  selectedCategoryId?: number | null;
  theme?: CatalogTheme;
}) {
  const categories = useCategoryStore((state) => state.categories);
  const categoriesById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const activeTheme = theme ?? buildCatalogTheme(null);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {stores.map((store) => {
        const primaryCategory = store.primary_category_id ? categoriesById.get(store.primary_category_id) : undefined;
        const categoryActive = storeMatchesCategory(store, selectedCategoryId ?? null);

        return (
          <Link
            key={store.id}
            to={`/c/tienda/${store.id}`}
            className="group overflow-hidden rounded border bg-white transition hover:-translate-y-1"
            style={{
              borderColor: categoryActive ? activeTheme.accentBorderStrong : activeTheme.accentBorder,
              backgroundImage: activeTheme.cardSurface,
              boxShadow: categoryActive
                ? `0 26px 52px -34px ${activeTheme.accentShadowStrong}`
                : `0 20px 40px -36px ${activeTheme.accentShadow}`
            }}
          >
            <div className="relative h-44 overflow-hidden">
              <div
                className="absolute inset-0 transition-transform duration-300 group-hover:scale-[1.03]"
                style={
                  store.cover_image_url
                    ? {
                        backgroundImage: `linear-gradient(180deg, rgba(24,24,27,0.12), rgba(24,24,27,0.82)), radial-gradient(circle at top right, ${activeTheme.accentGlow} 0%, transparent 36%), url(${store.cover_image_url})`,
                        backgroundSize: "cover, auto, cover",
                        backgroundPosition: "center, top right, center"
                      }
                    : {
                        backgroundImage: `radial-gradient(circle at top right, ${activeTheme.accentGlow} 0%, transparent 36%), linear-gradient(135deg, ${activeTheme.accentSoft} 0%, #211917 28%, #3d2418 100%)`
                      }
                }
              />
              <div className="absolute inset-x-0 top-0 h-16" style={{ background: `linear-gradient(180deg, ${activeTheme.accentSoft}, transparent)` }} />
              <div className="absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,transparent,rgba(24,24,27,0.82))]" />
              <div className="absolute left-4 top-4">
                <span
                  className="inline-flex rounded px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white"
                  style={{ backgroundColor: categoryActive ? activeTheme.accent : "rgba(24,24,27,0.72)" }}
                >
                  {store.primary_category ?? "Comercio"}
                </span>
              </div>
            </div>
            <div className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="truncate text-xl font-black tracking-tight">{store.name}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-600">{store.address}</p>
                </div>
                <span
                  className="rounded px-3 py-1 text-xs font-bold"
                  style={{
                    backgroundColor: categoryActive ? activeTheme.accentLight : "#FEF3C7",
                    color: categoryActive ? activeTheme.accent : "#92400E"
                  }}
                >
                  {store.rating.toFixed(1)} ({store.rating_count})
                </span>
              </div>

              <p className="line-clamp-2 text-sm leading-6 text-zinc-600">{store.description}</p>

              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <span className={`rounded px-3 py-1 ${store.is_open ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                  {store.is_open ? "Abierto" : "Cerrado"}
                </span>
                {store.primary_category ? (
                  <RubroChip
                    as="span"
                    label={store.primary_category}
                    color={primaryCategory?.color}
                    colorLight={primaryCategory?.color_light}
                    icon={primaryCategory?.icon}
                    size="sm"
                  />
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2 text-xs font-semibold text-zinc-500">
                <span
                  className="rounded px-3 py-1"
                  style={{
                    backgroundColor: categoryActive ? activeTheme.accentSoft : "#F4F4F5",
                    color: categoryActive ? activeTheme.textTint : "#71717A"
                  }}
                >
                  {store.delivery_settings.delivery_enabled
                    ? `Envio ${formatCurrency(store.delivery_settings.delivery_fee)}`
                    : "Solo retiro"}
                </span>
                <span
                  className="rounded px-3 py-1"
                  style={{
                    backgroundColor: categoryActive ? activeTheme.accentSoft : "#F4F4F5",
                    color: categoryActive ? activeTheme.textTint : "#71717A"
                  }}
                >
                  {store.payment_settings.cash_enabled ? "Efectivo" : "Sin efectivo"}
                </span>
                <span
                  className="rounded px-3 py-1"
                  style={{
                    backgroundColor: categoryActive ? activeTheme.accentSoft : "#F4F4F5",
                    color: categoryActive ? activeTheme.textTint : "#71717A"
                  }}
                >
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
