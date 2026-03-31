type BrandWordmarkProps = {
  brandName: string;
  wordmarkUrl?: string | null;
  className?: string;
  imageClassName?: string;
  textClassName?: string;
};

export function BrandWordmark({
  brandName,
  wordmarkUrl,
  className = "",
  imageClassName = "",
  textClassName = "",
}: BrandWordmarkProps) {
  if (wordmarkUrl) {
    return (
      <span className={className}>
        <img
          src={wordmarkUrl}
          alt={brandName}
          className={[
            "inline-block h-[1.15em] w-auto max-w-full align-[-0.18em] object-contain",
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
        "inline-block align-baseline",
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
