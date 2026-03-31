import { useEffect, useState, type ReactNode } from "react";
import { DEFAULT_CATALOG_BANNER_URL, resolveCatalogBannerDimensions } from "../../config/catalogBanner";
import { statusLabels } from "../../utils/labels";

export function LoadingCard({ label = "Cargando..." }: { label?: string }) {
  return (
    <div className="mesh-surface rounded-[30px] border border-white/80 p-5 shadow-lift sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Estado</p>
      <p className="mt-3 font-display text-[1.85rem] font-bold leading-[1.08] tracking-tight text-ink sm:text-2xl">
        {label}
      </p>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mesh-surface rounded-[32px] border border-dashed border-[#dbcabc] p-6 text-center shadow-lift sm:p-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-400">Sin resultados</p>
      <h3 className="mt-3 font-display text-[1.75rem] font-bold leading-[1.08] tracking-tight text-ink sm:text-2xl">
        {title}
      </h3>
      <p className="mt-3 text-sm leading-6 text-zinc-600 sm:leading-7">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function IntegrationPendingCard({
  title = "Proximamente",
  description = "Esta seccion estara disponible en una proxima actualizacion."
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">Pendiente</p>
      <h3 className="mt-2 text-lg font-bold">{title}</h3>
      <p className="mt-2 leading-6 sm:leading-7">{description}</p>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  backgroundImageUrl
}: {
  eyebrow: string;
  title: ReactNode;
  description?: string;
  action?: ReactNode;
  backgroundImageUrl?: string | null;
}) {
  const bannerUrl = backgroundImageUrl?.trim() || "";
  const hasBanner = Boolean(bannerUrl);
  return (
    <div
      className={`ambient-grid overflow-hidden rounded-[34px] p-5 text-white shadow-lift sm:p-6 ${
        hasBanner ? "min-h-[190px] md:min-h-[220px] bg-[#1d1614]" : "bg-[linear-gradient(135deg,#1d1614_0%,#281b18_45%,#3a221a_100%)]"
      }`}
      style={
        hasBanner
          ? {
              backgroundImage: `linear-gradient(180deg, rgba(17, 12, 10, 0.34), rgba(17, 12, 10, 0.74)), url(${bannerUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center"
            }
          : undefined
      }
    >
      {hasBanner ? (
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(20,14,12,0.52)_0%,rgba(20,14,12,0.2)_55%,rgba(20,14,12,0.38)_100%)]" />
      ) : null}
      <div className="absolute right-4 top-4 h-24 w-24 rounded-full bg-brand-400/20 blur-3xl" />
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="relative min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#ffd3bf]">{eyebrow}</p>
          <h1 className="mt-3 font-display text-[1.85rem] font-bold leading-[1.08] tracking-tight sm:text-3xl md:text-[2.35rem]">
            {title}
          </h1>
          {description ? <p className="mt-3 max-w-2xl text-sm leading-6 text-white/74 sm:leading-7">{description}</p> : null}
        </div>
        {action ? <div className="relative w-full md:w-auto md:shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

export function CatalogBanner({
  imageUrl,
  width,
  height,
  alt = "Banner del catalogo",
  fallbackImageUrl = DEFAULT_CATALOG_BANNER_URL,
}: {
  imageUrl?: string | null;
  width?: number | null;
  height?: number | null;
  alt?: string;
  fallbackImageUrl?: string;
}) {
  const resolvedDimensions = resolveCatalogBannerDimensions(width, height);
  const preferredImageUrl = imageUrl?.trim() || fallbackImageUrl;
  const [currentImageUrl, setCurrentImageUrl] = useState(preferredImageUrl);

  useEffect(() => {
    setCurrentImageUrl(preferredImageUrl);
  }, [preferredImageUrl]);

  return (
    <div className="mx-auto w-full overflow-hidden rounded-[34px] border border-black/5 bg-white shadow-lift" style={{ maxWidth: `${resolvedDimensions.width}px` }}>
      <img
        src={currentImageUrl}
        alt={alt}
        className="block w-full object-cover"
        style={{ aspectRatio: `${resolvedDimensions.width} / ${resolvedDimensions.height}` }}
        onError={() => {
          if (currentImageUrl !== fallbackImageUrl) {
            setCurrentImageUrl(fallbackImageUrl);
          }
        }}
      />
    </div>
  );
}

export function StatusPill({ value }: { value: string }) {
  return (
    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
      {statusLabels[value] ?? value}
    </span>
  );
}

export function StatCard({
  label,
  value,
  description
}: {
  label: string;
  value: string;
  description?: string;
}) {
  return (
    <article className="rounded-[28px] bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">{label}</p>
      <p className="mt-3 font-display text-[1.85rem] font-bold leading-[1.08] tracking-tight text-ink sm:text-3xl">
        {value}
      </p>
      {description ? <p className="mt-2 text-sm text-zinc-600">{description}</p> : null}
    </article>
  );
}
