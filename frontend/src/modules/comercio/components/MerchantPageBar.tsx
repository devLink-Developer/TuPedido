import type { ReactNode } from "react";

type MerchantPageStat = {
  label: string;
  value: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
};

function statToneClass(tone: MerchantPageStat["tone"] = "neutral") {
  if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-900";
  if (tone === "danger") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-black/5 bg-zinc-50 text-zinc-700";
}

export function MerchantPageBar({
  eyebrow,
  title,
  description,
  action,
  stats,
  children,
  className = ""
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  stats?: MerchantPageStat[];
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded border border-[var(--kp-stroke)] bg-white/94 px-3 py-2 shadow-sm backdrop-blur ${className}`}>
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
          {eyebrow ? (
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--kp-accent)]">
              {eyebrow}
            </span>
          ) : null}
          <h1 className="text-xl font-bold leading-tight text-ink">{title}</h1>
          {description ? <p className="min-w-[180px] flex-1 truncate text-[13px] text-zinc-600">{description}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 flex-wrap items-center gap-2 xl:justify-end">{action}</div> : null}
      </div>

      {stats?.length || children ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-[var(--kp-stroke)] pt-2">
          {stats?.map((stat) => (
            <span
              key={stat.label}
              className={`inline-flex min-h-[30px] items-center gap-1.5 rounded border px-2.5 text-xs font-semibold ${statToneClass(stat.tone)}`}
            >
              <span className="text-[10px] uppercase tracking-[0.14em] opacity-70">{stat.label}</span>
              <span className="tabular-nums text-ink">{stat.value}</span>
            </span>
          ))}
          {children ? <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">{children}</div> : null}
        </div>
      ) : null}
    </section>
  );
}
