import { isBundledWordmarkPosterUrl, KE_BRAND_NAME } from "../../config/brand";
import { usePlatformBranding } from "../../providers/PlatformBrandingProvider";
import { resolveApiMediaUrl } from "../../services/api/client";

type BrandMarkProps = {
  brandName?: string;
  logoUrl?: string | null;
  className?: string;
  imageClassName?: string;
  textClassName?: string;
};

export function BrandMark({
  brandName,
  logoUrl,
  className = "",
  imageClassName = "",
}: BrandMarkProps) {
  const branding = usePlatformBranding();
  const resolvedBrandName = brandName ?? branding.brandName ?? KE_BRAND_NAME;
  const candidateLogoUrl = (logoUrl ?? branding.logoUrl ?? branding.wordmarkUrl)?.trim();
  const resolvedLogoUrl = candidateLogoUrl && !isBundledWordmarkPosterUrl(candidateLogoUrl) ? candidateLogoUrl : null;

  return (
    <span className={["inline-flex items-center", className].filter(Boolean).join(" ")}>
      {resolvedLogoUrl ? (
        <span aria-hidden="true" className="inline-flex h-9 w-[8.5rem] shrink-0 items-center sm:h-10 sm:w-[9.5rem]">
          <img
            src={resolveApiMediaUrl(resolvedLogoUrl)}
            alt=""
            className={["h-full w-full object-contain", imageClassName].filter(Boolean).join(" ")}
          />
        </span>
      ) : (
        <span
          aria-hidden="true"
          className={[
            "ke-brand-sprite h-9 w-[8.5rem] sm:h-10 sm:w-[9.5rem]",
            imageClassName,
          ]
            .filter(Boolean)
            .join(" ")}
        />
      )}
      <span className="sr-only">{resolvedBrandName}</span>
    </span>
  );
}
