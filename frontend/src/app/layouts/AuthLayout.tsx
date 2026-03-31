import type { PropsWithChildren } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "../../shared/components";
import { usePlatformBranding } from "../../shared/providers/PlatformBrandingProvider";

export function AuthLayout({ children }: PropsWithChildren) {
  const { brandName, branding } = usePlatformBranding();

  return (
    <div className="ambient-grid min-h-screen bg-[linear-gradient(180deg,#f7ecdf_0%,#fff8f1_55%,#f9f2e9_100%)] px-4 py-6 text-ink md:px-8 md:py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <Link to="/" aria-label={`Ir al inicio de ${brandName}`} className="inline-flex items-center">
            <BrandMark
              brandName={brandName}
              logoUrl={branding?.platform_logo_url ?? null}
              imageClassName="h-12 max-w-[12.5rem] sm:h-14 sm:max-w-[14rem]"
              textClassName="text-[clamp(1.7rem,4vw,2.35rem)] text-[#24130e]"
            />
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
