type BrandMarkProps = {
  brandName: string;
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
  textClassName = "",
}: BrandMarkProps) {
  if (logoUrl) {
    return (
      <span className={className}>
        <img
          src={logoUrl}
          alt={brandName}
          className={[
            "block h-11 w-auto max-w-[11rem] object-contain",
            imageClassName,
          ]
            .filter(Boolean)
            .join(" ")}
        />
      </span>
    );
  }

  return (
    <span
      className={[
        "font-display text-2xl font-black tracking-tight text-[#1d120e]",
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
