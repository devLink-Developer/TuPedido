import { useEffect, useMemo, useState } from "react";
import { useCategoryStore } from "../../../shared/stores";
import type { Category } from "../../../shared/types";
import { BenefitsSection } from "../components/BenefitsSection";
import { CategoryGrid } from "../components/CategoryGrid";
import { CTAComercio } from "../components/CTAComercio";
import { Footer } from "../components/Footer";
import { HeroAddressSearch } from "../components/HeroAddressSearch";
import { buildLandingTheme } from "../utils/landingTheme";

function findCategoryBySlug(categories: Category[], slug: string | null) {
  if (!slug) return null;
  return categories.find((category) => category.slug === slug) ?? null;
}

export function LandingPage() {
  const categories = useCategoryStore((state) => state.categories);
  const loaded = useCategoryStore((state) => state.loaded);
  const loading = useCategoryStore((state) => state.loading);
  const loadCategories = useCategoryStore((state) => state.loadCategories);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded && !loading) {
      void loadCategories();
    }
  }, [loaded, loading, loadCategories]);

  const selectedCategory = useMemo(
    () => findCategoryBySlug(categories, selectedCategorySlug),
    [categories, selectedCategorySlug]
  );
  const theme = useMemo(() => buildLandingTheme(selectedCategory), [selectedCategory]);

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

  const visibleCategories = useMemo(() => categories.slice(0, 6), [categories]);

  return (
    <div className="space-y-6">
      <HeroAddressSearch selectedCategory={selectedCategory} theme={theme} />
      <CategoryGrid
        categories={visibleCategories}
        loading={loading}
        selectedCategory={selectedCategory}
        selectedCategorySlug={selectedCategorySlug}
        onSelectCategory={(slug) => setSelectedCategorySlug((current) => (current === slug ? null : slug))}
        theme={theme}
      />
      <BenefitsSection selectedCategory={selectedCategory} theme={theme} />
      <CTAComercio selectedCategory={selectedCategory} theme={theme} />
      <Footer selectedCategory={selectedCategory} theme={theme} />
    </div>
  );
}

