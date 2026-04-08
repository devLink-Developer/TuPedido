import type { PropsWithChildren } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "../../shared/components";
import { usePlatformBranding } from "../../shared/providers/PlatformBrandingProvider";

export function AuthLayout({ children }: PropsWithChildren) {
  const { brandName, branding } = usePlatformBranding();

  return (
    <div className="app-shell ambient-grid min-h-screen px-4 py-6 text-ink md:px-8 md:py-8">
      <div className="mx-auto max-w-6xl">
        <div className="app-toolbar mb-6 inline-flex rounded-[26px] px-4 py-4 sm:px-5">
          <Link to="/" aria-label={`Ir al inicio de ${brandName}`} className="inline-flex items-center">
            <BrandMark
              brandName={brandName}
              logoUrl={branding?.platform_logo_url ?? null}
              imageClassName="h-11 max-w-[12rem] sm:h-12 sm:max-w-[13.5rem]"
              textClassName="text-[clamp(1.6rem,4vw,2.3rem)] text-[#24130e]"
            />
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
