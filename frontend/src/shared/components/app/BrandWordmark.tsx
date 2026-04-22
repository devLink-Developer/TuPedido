import { resolveApiMediaUrl } from "../../services/api/client";

type BrandWordmarkProps = {
  brandName: string;
  wordmarkUrl?: string | null;
  size?: "eyebrow" | "inline" | "title" | "hero";
  fit?: "contain" | "cover";
  className?: string;
  frameClassName?: string;
  imageClassName?: string;
  textClassName?: string;
};

const sizeFrames: Record<NonNullable<BrandWordmarkProps["size"]>, string> = {
  eyebrow: "h-6 w-[8rem] overflow-hidden sm:h-7 sm:w-[9rem]",
  inline: "h-6 w-[8.25rem] overflow-hidden sm:h-7 sm:w-[9.5rem]",
  title: "h-10 w-[11rem] overflow-hidden sm:h-12 sm:w-[13.5rem]",
  hero: "h-14 w-[13.5rem] overflow-hidden sm:h-[4.75rem] sm:w-[17rem]",
};

const sizeTexts: Record<NonNullable<BrandWordmarkProps["size"]>, string> = {
  eyebrow: "text-sm sm:text-base",
  inline: "text-sm sm:text-base",
  title: "text-2xl sm:text-3xl",
  hero: "text-[2rem] sm:text-4xl",
};

export function BrandWordmark({
  brandName,
  wordmarkUrl,
  size = "inline",
  fit = "contain",
  className = "",
  frameClassName = "",
  imageClassName = "",
  textClassName = "",
}: BrandWordmarkProps) {
  if (wordmarkUrl) {
    return (
      <span className={["inline-flex items-center", className].filter(Boolean).join(" ")}>
        <span
          className={[
            "inline-flex shrink-0 items-center",
            sizeFrames[size],
            frameClassName,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <img
            src={resolveApiMediaUrl(wordmarkUrl)}
            alt={brandName}
            className={[
              "inline-block h-full w-full max-w-none object-center",
              fit === "cover" ? "object-cover" : "object-contain",
              imageClassName,
            ]
              .filter(Boolean)
              .join(" ")}
          />
        </span>
      </span>
    );
  }

  return (
    <span
      className={[
        "inline-block align-baseline",
        sizeTexts[size],
        className,
        textClassName,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {brandName}
    </span>
  );
}
