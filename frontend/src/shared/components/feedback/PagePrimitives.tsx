import { useEffect, useState, type ReactNode } from "react";
import { DEFAULT_CATALOG_BANNER_URL, resolveCatalogBannerDimensions } from "../../config/catalogBanner";
import { resolveApiMediaUrl } from "../../services/api/client";
import { statusLabels } from "../../utils/labels";

function resolveStatusPillStyle(value: string) {
  const normalized = value.toLowerCase();

  if (["approved", "delivered", "paid", "active", "available", "online", "completed", "idle"].some((item) => normalized.includes(item))) {
    return {
      backgroundColor: "var(--color-success-soft)",
      borderColor: "rgba(22,163,74,0.18)",
      color: "#166534"
    };
  }

  if (
    [
      "pending",
      "review",
      "draft",
      "created",
      "new",
      "pickup",
      "assigned",
      "processing",
      "preparing"
    ].some((item) => normalized.includes(item))
  ) {
    return {
      backgroundColor: "var(--color-warning-soft)",
      borderColor: "rgba(245,158,11,0.2)",
      color: "#b45309"
    };
  }

  if (["cancelled", "rejected", "suspended", "offline", "failed", "error"].some((item) => normalized.includes(item))) {
    return {
      backgroundColor: "var(--color-error-soft)",
      borderColor: "rgba(220,38,38,0.16)",
      color: "#b91c1c"
    };
  }

  return {
    backgroundColor: "rgba(255,255,255,0.88)",
    borderColor: "var(--color-border-default)",
    color: "var(--page-muted)"
  };
}

export function LoadingCard({ label = "Cargando..." }: { label?: string }) {
  return (
    <div className="mesh-surface border border-[var(--color-border-default)] p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">Estado</p>
          <p className="mt-2.5 font-display text-[1.72rem] font-bold leading-[1.04] tracking-tight text-ink sm:text-[2.05rem]">
            {label}
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-600">Preparamos la vista sin bloquear la navegación ni el contexto visual.</p>
        </div>
        <div className="grid grid-cols-3 gap-3 self-start">
          {Array.from({ length: 3 }, (_, index) => (
            <span key={index} className="h-14 w-14 animate-pulse border border-white/70 bg-white/80" />
          ))}
        </div>
      </div>
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
    <div className="mesh-surface border border-dashed border-[var(--color-border-default)] p-5 text-center shadow-sm sm:p-7">
      <span className="app-chip text-[10px] uppercase tracking-[0.24em] text-zinc-500">Sin resultados</span>
      <h3 className="mx-auto mt-3.5 max-w-2xl font-display text-[1.55rem] font-bold leading-[1.04] tracking-tight text-ink sm:text-[1.95rem]">
        {title}
      </h3>
      <p className="mx-auto mt-2.5 max-w-2xl text-sm leading-6 text-zinc-600">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
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
    <div className="border border-[rgba(245,158,11,0.18)] bg-[linear-gradient(180deg,#fff8ef_0%,#fffdf9_100%)] p-5 text-sm text-amber-950 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">Pendiente</p>
      <h3 className="mt-2 text-lg font-bold">{title}</h3>
      <p className="mt-2 leading-6 text-amber-900/78">{description}</p>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  backgroundImageUrl,
  className,
  contentClassName,
  titleClassName,
  descriptionClassName
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  backgroundImageUrl?: string | null;
  className?: string;
  contentClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
}) {
  const bannerUrl = backgroundImageUrl?.trim() ? resolveApiMediaUrl(backgroundImageUrl) : "";
  const hasBanner = Boolean(bannerUrl);

  return (
    <div
      className={[
        "app-panel-dark ambient-grid overflow-hidden border border-white/10 p-5 shadow-lift sm:p-6",
        hasBanner ? "min-h-[200px] md:min-h-[228px]" : "",
        className ?? ""
      ].join(" ")}
      style={
        hasBanner
          ? {
              backgroundImage: `linear-gradient(100deg, rgba(16,11,10,0.86) 0%, rgba(16,11,10,0.54) 46%, rgba(16,11,10,0.8) 100%), url(${bannerUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center"
            }
          : undefined
      }
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,123,70,0.14),transparent_18%)]" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-28 w-full bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.12))]" />
      <div className={["relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between", contentClassName ?? ""].join(" ")}>
        <div className="min-w-0">
          <span className="inline-flex border border-white/12 bg-white/8 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-[#ffd3bf] sm:text-[11px]">
            {eyebrow}
          </span>
          <h1
            className={[
              "mt-3.5 max-w-4xl font-display text-[1.82rem] font-bold leading-[1.02] tracking-tight text-white sm:text-[2.18rem] md:text-[2.48rem]",
              titleClassName ?? ""
            ].join(" ")}
          >
            {title}
          </h1>
          {description ? (
            <div className={["mt-3 max-w-3xl text-sm leading-6 text-white/74 md:text-[15px]", descriptionClassName ?? ""].join(" ")}>{description}</div>
          ) : null}
        </div>
        {action ? <div className="relative flex w-full flex-wrap gap-2 md:w-auto md:shrink-0 md:justify-end">{action}</div> : null}
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
  const preferredImageUrl = imageUrl?.trim() ? resolveApiMediaUrl(imageUrl) : fallbackImageUrl;
  const [currentImageUrl, setCurrentImageUrl] = useState(preferredImageUrl);

  useEffect(() => {
    setCurrentImageUrl(preferredImageUrl);
  }, [preferredImageUrl]);

  return (
    <div className="mx-auto w-full overflow-hidden border border-white/80 bg-white shadow-lift" style={{ maxWidth: `${resolvedDimensions.width}px` }}>
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
    <span
      className="inline-flex border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em]"
      style={resolveStatusPillStyle(value)}
    >
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
    <article className="app-panel border p-4">
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">{label}</p>
        <p className="mt-3 font-display text-[1.72rem] font-bold leading-[1.04] tracking-tight text-ink sm:text-[1.95rem]">
          {value}
        </p>
        {description ? <p className="mt-2.5 text-sm leading-6 text-zinc-600">{description}</p> : null}
      </div>
    </article>
  );
}
