import { AlertCircle, LoaderCircle, SearchX } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { DEFAULT_CATALOG_BANNER_URL, resolveCatalogBannerDimensions } from "../../config/catalogBanner";
import { resolveApiMediaUrl } from "../../services/api/client";
import { statusLabels } from "../../utils/labels";

function resolveStatusPillStyle(value: string) {
  const normalized = value.toLowerCase();

  if (["approved", "delivered", "paid", "active", "available", "online", "completed", "idle"].some((item) => normalized.includes(item))) {
    return {
      backgroundColor: "var(--color-success-soft)",
      borderColor: "rgba(21,128,61,0.2)",
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
      borderColor: "rgba(180,83,9,0.22)",
      color: "#92400e"
    };
  }

  if (["cancelled", "rejected", "suspended", "offline", "failed", "error"].some((item) => normalized.includes(item))) {
    return {
      backgroundColor: "var(--color-error-soft)",
      borderColor: "rgba(185,28,28,0.18)",
      color: "#991b1b"
    };
  }

  return {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderColor: "var(--color-border-default)",
    color: "var(--page-muted)"
  };
}

export function LoadingCard({ label = "Cargando..." }: { label?: string }) {
  return (
    <div className="app-panel p-5 sm:p-6" aria-live="polite">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">Estado</p>
          <p className="mt-2.5 font-display text-[1.35rem] font-bold leading-tight text-ink sm:text-[1.6rem]">
            {label}
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">Actualizando la informacion de la vista.</p>
        </div>
        <LoaderCircle className="h-6 w-6 animate-spin text-[var(--kp-accent)]" aria-hidden="true" />
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
    <div className="app-panel border-dashed p-5 text-center sm:p-7">
      <span className="app-chip text-[10px] uppercase tracking-[0.24em] text-zinc-500">
        <SearchX className="h-4 w-4 text-[var(--kp-accent)]" aria-hidden="true" />
        Sin resultados
      </span>
      <h3 className="mx-auto mt-3.5 max-w-2xl font-display text-[1.35rem] font-bold leading-tight text-ink sm:text-[1.6rem]">
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
    <div className="app-panel border-[rgba(245,158,11,0.24)] bg-[linear-gradient(180deg,#fff8ef_0%,#fffdf9_100%)] p-5 text-sm text-amber-950">
      <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
        Pendiente
      </p>
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
        hasBanner ? "app-panel-dark ambient-grid min-h-[188px] overflow-hidden p-5 sm:p-6" : "app-panel p-5 sm:p-6",
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
      {hasBanner ? (
        <>
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,123,70,0.14),transparent_18%)]" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-28 w-full bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.12))]" />
        </>
      ) : null}
      <div className={["relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between", contentClassName ?? ""].join(" ")}>
        <div className="min-w-0">
          <span
            className={[
              "inline-flex border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] sm:text-[11px]",
              hasBanner ? "border-white/12 bg-white/8 text-[#ffd3bf]" : "app-chip text-[var(--kp-accent)]"
            ].join(" ")}
          >
            {eyebrow}
          </span>
          <h1
            className={[
              "mt-3.5 max-w-4xl font-display text-[1.65rem] font-bold leading-tight sm:text-[1.95rem] md:text-[2.2rem]",
              hasBanner ? "text-white" : "text-ink",
              titleClassName ?? ""
            ].join(" ")}
          >
            {title}
          </h1>
          {description ? (
            <div
              className={[
                "mt-3 max-w-3xl text-sm leading-6 md:text-[15px]",
                hasBanner ? "text-white/74" : "text-zinc-600",
                descriptionClassName ?? ""
              ].join(" ")}
            >
              {description}
            </div>
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
    <div className="mx-auto w-full overflow-hidden border border-[var(--kp-stroke)] bg-white shadow-lift" style={{ maxWidth: `${resolvedDimensions.width}px` }}>
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
      className="app-chip text-xs uppercase tracking-[0.14em]"
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
    <article className="app-panel p-4">
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">{label}</p>
        <p className="mt-3 font-display text-[1.5rem] font-bold leading-tight text-ink sm:text-[1.75rem]">
          {value}
        </p>
        {description ? <p className="mt-2.5 text-sm leading-6 text-zinc-600">{description}</p> : null}
      </div>
    </article>
  );
}
