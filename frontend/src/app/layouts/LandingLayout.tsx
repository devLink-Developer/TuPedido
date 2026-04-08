import type { PropsWithChildren } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "../../shared/components";
import { usePlatformBranding } from "../../shared/providers/PlatformBrandingProvider";

export function LandingLayout({ children }: PropsWithChildren) {
  const { brandName, branding } = usePlatformBranding();

  return (
    <div className="app-shell ambient-grid min-h-screen text-ink">
      <header className="sticky top-0 z-30 px-3 pt-[calc(0.75rem+var(--safe-top))] md:px-6 md:pt-5">
        <div className="app-toolbar mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-[28px] px-4 py-4 md:px-6">
          <Link to="/" aria-label={`Ir al inicio de ${brandName}`} className="inline-flex items-center">
            <BrandMark
              brandName={brandName}
              logoUrl={branding?.platform_logo_url ?? null}
              imageClassName="h-11 max-w-[12rem] drop-shadow-[0_12px_24px_rgba(173,74,14,0.16)] sm:h-12 sm:max-w-[13.5rem]"
              textClassName="text-[clamp(1.6rem,3vw,2.2rem)] text-[#24130e]"
            />
          </Link>
          <div className="flex items-center gap-2">
            <Link
              className="inline-flex min-h-[44px] items-center rounded-full border border-[var(--landing-accent-border)] bg-white/88 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:-translate-y-0.5 hover:border-brand-200 hover:text-ink"
              to="/login"
            >
              Ingresar
            </Link>
            <Link
              className="app-button px-4 py-2 text-sm"
              to="/registro"
            >
              Crear cuenta
            </Link>
          </div>
        </div>
      </header>
      <main className="relative mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
