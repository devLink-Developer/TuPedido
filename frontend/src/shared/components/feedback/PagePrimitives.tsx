import { useEffect, useState, type ReactNode } from "react";
import { DEFAULT_CATALOG_BANNER_URL, resolveCatalogBannerDimensions } from "../../config/catalogBanner";
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
    <div className="mesh-surface rounded-[32px] border border-[var(--color-border-default)] p-6 shadow-sm sm:p-7">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">Estado</p>
          <p className="mt-3 font-display text-[1.95rem] font-bold leading-[1.04] tracking-tight text-ink sm:text-[2.35rem]">
            {label}
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-600">Preparamos la vista sin bloquear la navegación ni el contexto visual.</p>
        </div>
        <div className="grid grid-cols-3 gap-3 self-start">
          {Array.from({ length: 3 }, (_, index) => (
            <span key={index} className="h-16 w-16 animate-pulse rounded-[22px] border border-white/70 bg-white/80" />
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
    <div className="mesh-surface rounded-[32px] border border-dashed border-[var(--color-border-default)] p-6 text-center shadow-sm sm:p-8">
      <span className="app-chip text-[10px] uppercase tracking-[0.24em] text-zinc-500">Sin resultados</span>
      <h3 className="mx-auto mt-4 max-w-2xl font-display text-[1.8rem] font-bold leading-[1.04] tracking-tight text-ink sm:text-[2.2rem]">
        {title}
      </h3>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-zinc-600">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
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
    <div className="rounded-[28px] border border-[rgba(245,158,11,0.18)] bg-[linear-gradient(180deg,#fff8ef_0%,#fffdf9_100%)] p-5 text-sm text-amber-950 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">Pendiente</p>
      <h3 className="mt-2 text-lg font-bold">{title}</h3>
      <p className="mt-2 leading-7 text-amber-900/78">{description}</p>
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
  const bannerUrl = backgroundImageUrl?.trim() || "";
  const hasBanner = Boolean(bannerUrl);

  return (
    <div
      className={[
        "app-panel-dark ambient-grid overflow-hidden rounded-[36px] p-6 shadow-lift sm:p-7",
        hasBanner ? "min-h-[220px] md:min-h-[250px]" : "",
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
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,123,70,0.22),transparent_28%)]" />
      <div className="pointer-events-none absolute -right-10 top-0 h-44 w-44 rounded-full bg-brand-400/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-28 w-full bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.1))]" />
      <div className={["relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between", contentClassName ?? ""].join(" ")}>
        <div className="min-w-0">
          <span className="inline-flex rounded-full border border-white/12 bg-white/8 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.32em] text-[#ffd3bf] sm:text-[11px]">
            {eyebrow}
          </span>
          <h1
            className={[
              "mt-4 max-w-4xl font-display text-[2rem] font-bold leading-[1.02] tracking-tight text-white sm:text-[2.4rem] md:text-[2.75rem]",
              titleClassName ?? ""
            ].join(" ")}
          >
            {title}
          </h1>
          {description ? (
            <div className={["mt-4 max-w-3xl text-sm leading-7 text-white/74 md:text-[15px]", descriptionClassName ?? ""].join(" ")}>{description}</div>
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
  const preferredImageUrl = imageUrl?.trim() || fallbackImageUrl;
  const [currentImageUrl, setCurrentImageUrl] = useState(preferredImageUrl);

  useEffect(() => {
    setCurrentImageUrl(preferredImageUrl);
  }, [preferredImageUrl]);

  return (
    <div className="mx-auto w-full overflow-hidden rounded-[34px] border border-white/80 bg-white shadow-lift" style={{ maxWidth: `${resolvedDimensions.width}px` }}>
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
      className="inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold"
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
    <article className="app-panel rounded-[28px] p-5">
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">{label}</p>
        <p className="mt-4 font-display text-[2rem] font-bold leading-[1.04] tracking-tight text-ink sm:text-[2.25rem]">
          {value}
        </p>
        {description ? <p className="mt-3 text-sm leading-7 text-zinc-600">{description}</p> : null}
      </div>
    </article>
  );
}
