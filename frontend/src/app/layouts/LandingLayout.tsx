import type { PropsWithChildren } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "../../shared/components";
import { usePlatformBranding } from "../../shared/providers/PlatformBrandingProvider";

export function LandingLayout({ children }: PropsWithChildren) {
  const { brandName, branding } = usePlatformBranding();

  return (
    <div className="ambient-grid min-h-screen text-ink">
      <header className="sticky top-0 z-30 border-b bg-[rgba(255,251,246,0.88)] backdrop-blur" style={{ borderColor: "var(--landing-accent-border)" }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-8">
          <Link to="/" aria-label={`Ir al inicio de ${brandName}`} className="inline-flex items-center">
            <BrandMark
              brandName={brandName}
              logoUrl={branding?.platform_logo_url ?? null}
              imageClassName="h-12 max-w-[13rem] drop-shadow-[0_12px_24px_rgba(173,74,14,0.16)] sm:h-14 sm:max-w-[14.5rem]"
              textClassName="text-[clamp(1.7rem,3vw,2.25rem)] text-[#24130e]"
            />
          </Link>
          <div className="flex items-center gap-2">
            <Link
              className="rounded-full border bg-white/80 px-4 py-2 text-sm font-semibold text-zinc-700 transition"
              style={{ borderColor: "var(--landing-accent-border)" }}
              to="/login"
            >
              Ingresar
            </Link>
            <Link
              className="rounded-full px-4 py-2 text-sm font-semibold text-white shadow-float"
              style={{
                backgroundImage: "linear-gradient(135deg, var(--landing-accent), rgba(0, 0, 0, 0.22))",
                boxShadow: `0 18px 36px -22px var(--landing-accent-shadow)`
              }}
              to="/registro"
            >
              Crear cuenta
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
