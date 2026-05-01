import { KE_BRAND_NAME } from "../../config/brand";

type BrandMarkProps = {
  brandName?: string;
  logoUrl?: string | null;
  className?: string;
  imageClassName?: string;
  textClassName?: string;
};

export function BrandMark({
  brandName = KE_BRAND_NAME,
  className = "",
  imageClassName = "",
}: BrandMarkProps) {
  return (
    <span className={["inline-flex items-center", className].filter(Boolean).join(" ")}>
      <span
        aria-hidden="true"
        className={[
          "ke-brand-sprite h-9 w-[8.5rem] sm:h-10 sm:w-[9.5rem]",
          imageClassName,
        ]
          .filter(Boolean)
          .join(" ")}
      />
      <span className="sr-only">{brandName}</span>
    </span>
  );
}
