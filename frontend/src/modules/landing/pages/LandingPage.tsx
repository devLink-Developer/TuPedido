import { useEffect, useMemo } from "react";
import { BenefitsSection } from "../components/BenefitsSection";
import { CTAComercio } from "../components/CTAComercio";
import { Footer } from "../components/Footer";
import { HeroAddressSearch } from "../components/HeroAddressSearch";
import { buildLandingTheme } from "../utils/landingTheme";

export function LandingPage() {
  const theme = useMemo(() => buildLandingTheme(null), []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--landing-accent", theme.accent);
    root.style.setProperty("--landing-accent-light", theme.accentLight);
    root.style.setProperty("--landing-accent-border", theme.accentBorder);
    root.style.setProperty("--landing-accent-shadow", theme.accentShadow);
    root.style.setProperty("--page-glow", theme.pageGlow);
  }, [theme]);

  useEffect(
    () => () => {
      const root = document.documentElement;
      root.style.removeProperty("--landing-accent");
      root.style.removeProperty("--landing-accent-light");
      root.style.removeProperty("--landing-accent-border");
      root.style.removeProperty("--landing-accent-shadow");
      root.style.removeProperty("--page-glow");
    },
    []
  );
  return (
    <div className="space-y-6">
      <HeroAddressSearch theme={theme} />
      <BenefitsSection theme={theme} />
      <CTAComercio theme={theme} />
      <Footer theme={theme} />
    </div>
  );
}
