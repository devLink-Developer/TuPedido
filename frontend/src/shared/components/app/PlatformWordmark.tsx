import { usePlatformBranding } from "../../providers/PlatformBrandingProvider";
import { BrandWordmark } from "./BrandWordmark";

type PlatformWordmarkProps = {
  size?: "eyebrow" | "inline" | "title" | "hero";
  className?: string;
  frameClassName?: string;
  imageClassName?: string;
  textClassName?: string;
};

export function PlatformWordmark(props: PlatformWordmarkProps) {
  const { brandName, wordmarkUrl } = usePlatformBranding();

  return <BrandWordmark brandName={brandName} wordmarkUrl={wordmarkUrl} {...props} />;
}
