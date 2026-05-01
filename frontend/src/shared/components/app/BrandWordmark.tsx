import { KE_BRAND_NAME } from "../../config/brand";

type BrandWordmarkProps = {
  brandName?: string;
  wordmarkUrl?: string | null;
  size?: "eyebrow" | "inline" | "title" | "hero";
  fit?: "contain" | "cover";
  className?: string;
  frameClassName?: string;
  imageClassName?: string;
  textClassName?: string;
};

const sizeFrames: Record<NonNullable<BrandWordmarkProps["size"]>, string> = {
  eyebrow: "h-6 w-[7.25rem] sm:h-7 sm:w-[8.25rem]",
  inline: "h-7 w-[8.25rem] sm:h-8 sm:w-[9.25rem]",
  title: "h-10 w-[10rem] sm:h-11 sm:w-[11.5rem]",
  hero: "h-14 w-[13rem] sm:h-16 sm:w-[15rem]",
};

const spriteStyles: Record<NonNullable<BrandWordmarkProps["size"]>, { backgroundSize: string; backgroundPosition: string }> = {
  eyebrow: { backgroundSize: "560px 373px", backgroundPosition: "-32px -9px" },
  inline: { backgroundSize: "620px 413px", backgroundPosition: "-36px -10px" },
  title: { backgroundSize: "706px 471px", backgroundPosition: "-41px -12px" },
  hero: { backgroundSize: "930px 620px", backgroundPosition: "-54px -16px" },
};

export function BrandWordmark({
  brandName = KE_BRAND_NAME,
  size = "inline",
  className = "",
  frameClassName = "",
  imageClassName = "",
}: BrandWordmarkProps) {
  return (
    <span className={["inline-flex items-center", className].filter(Boolean).join(" ")}>
      <span
        aria-hidden="true"
        className={[
          "ke-brand-sprite shrink-0",
          sizeFrames[size],
          frameClassName,
          imageClassName,
        ]
          .filter(Boolean)
          .join(" ")}
        style={spriteStyles[size]}
      />
      <span className="sr-only">{brandName}</span>
    </span>
  );
}
