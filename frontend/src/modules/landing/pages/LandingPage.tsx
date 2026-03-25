import { BenefitsSection } from "../components/BenefitsSection";
import { CategoryGrid } from "../components/CategoryGrid";
import { CTAComercio } from "../components/CTAComercio";
import { CTARider } from "../components/CTARider";
import { Footer } from "../components/Footer";
import { HeroAddressSearch } from "../components/HeroAddressSearch";

export function LandingPage() {
  return (
    <div className="space-y-6">
      <HeroAddressSearch />
      <CategoryGrid />
      <BenefitsSection />
      <CTAComercio />
      <CTARider />
      <Footer />
    </div>
  );
}
