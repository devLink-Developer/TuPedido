import type { ReactNode } from "react";

export function HelpTooltip({
  label,
  children,
  variant = "surface"
}: {
  label: string;
  children: ReactNode;
  variant?: "surface" | "inverse";
}) {
  const buttonClassName =
    variant === "inverse"
      ? "border-white/25 bg-white/10 text-white hover:bg-white/20 focus:ring-white/30"
      : "border-black/10 bg-zinc-100 text-zinc-600 hover:bg-zinc-200 focus:ring-zinc-300";

  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        title={label}
        className={`inline-flex h-5 w-5 items-center justify-center border text-[11px] font-bold transition focus:outline-none focus:ring-2 ${buttonClassName}`}
      >
        ?
      </button>
      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-64 -translate-x-1/2 border border-white/10 bg-[#1d1614] px-3 py-2 text-left text-xs font-medium leading-5 text-white shadow-xl group-hover:block group-focus-within:block">
        {children}
      </span>
    </span>
  );
}
