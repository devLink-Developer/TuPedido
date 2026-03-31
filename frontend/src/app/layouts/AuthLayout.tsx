import type { PropsWithChildren } from "react";
import { Link } from "react-router-dom";
import { usePlatformBranding } from "../../shared/providers/PlatformBrandingProvider";

export function AuthLayout({ children }: PropsWithChildren) {
  const { brandName, logoUrl } = usePlatformBranding();

  return (
    <div className="ambient-grid min-h-screen bg-[linear-gradient(180deg,#f7ecdf_0%,#fff8f1_55%,#f9f2e9_100%)] px-4 py-6 text-ink md:px-8 md:py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src={logoUrl} alt={brandName} className="h-11 w-11 rounded-[1.2rem] bg-white object-contain shadow-float" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-400">Acceso</p>
              <p className="font-display text-lg font-bold tracking-tight">{brandName}</p>
            </div>
          </Link>
          <Link className="w-full rounded-full border border-black/10 bg-white/80 px-4 py-2 text-center text-sm font-semibold text-zinc-700 sm:w-auto" to="/">
            Volver al inicio
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
