import type { ReactNode } from "react";
import { statusLabels } from "../../utils/labels";

export function LoadingCard({ label = "Cargando..." }: { label?: string }) {
  return (
    <div className="mesh-surface rounded-[30px] border border-white/80 p-6 shadow-lift">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Estado</p>
      <p className="mt-3 font-display text-2xl font-bold tracking-tight text-ink">{label}</p>
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
    <div className="mesh-surface rounded-[32px] border border-dashed border-[#dbcabc] p-8 text-center shadow-lift">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-400">Sin resultados</p>
      <h3 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-zinc-600">{description}</p>
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
      <p className="mt-2 leading-7">{description}</p>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="ambient-grid overflow-hidden rounded-[34px] bg-[linear-gradient(135deg,#1d1614_0%,#281b18_45%,#3a221a_100%)] p-6 text-white shadow-lift">
      <div className="absolute right-4 top-4 h-24 w-24 rounded-full bg-brand-400/20 blur-3xl" />
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#ffd3bf]">{eyebrow}</p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight md:text-[2.35rem]">{title}</h1>
          {description ? <p className="mt-3 max-w-2xl text-sm leading-7 text-white/74">{description}</p> : null}
        </div>
        {action ? <div className="relative">{action}</div> : null}
      </div>
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
      <p className="mt-3 font-display text-3xl font-bold tracking-tight text-ink">{value}</p>
      {description ? <p className="mt-2 text-sm text-zinc-600">{description}</p> : null}
    </article>
  );
}
