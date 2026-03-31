import { Link } from "react-router-dom";
import { PlatformWordmark } from "../../../shared/components";
import type { Category } from "../../../shared/types";
import type { LandingTheme } from "../utils/landingTheme";

export function CTAComercio({
  selectedCategory,
  theme
}: {
  selectedCategory: Category | null;
  theme: LandingTheme;
}) {
  return (
    <section
      className="rounded-[32px] p-6 text-white shadow-lift transition-[background,box-shadow] duration-300"
      style={{
        backgroundImage: theme.commerceGradient,
        boxShadow: `0 28px 56px -40px ${theme.accentShadowStrong}`
      }}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: selectedCategory ? "#FFFFFF" : "rgb(254 215 170)" }}>
            Comercio
          </p>
          <h2 className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 font-display text-3xl font-bold tracking-tight">
            <span>Haz crecer tu negocio con</span>
            <PlatformWordmark
              size="title"
              frameClassName="w-[12.5rem] sm:w-[15rem]"
              textClassName="text-3xl"
            />
          </h2>
          <p className="mt-3 text-sm leading-7 text-white/72">
            Publica tu catalogo, ordena tu operacion diaria y destaca mejor lo que vendes desde el primer vistazo.
          </p>
          {selectedCategory ? (
            <div
              className="mt-4 inline-flex rounded-full border px-4 py-2 text-sm font-semibold"
              style={{ borderColor: theme.accentBorderStrong, backgroundColor: theme.accentMuted, color: "#FFFFFF" }}
            >
              Ideal para comercios de {selectedCategory.name.toLowerCase()}
            </div>
          ) : null}
        </div>

        <Link
          className="inline-flex rounded-full px-5 py-3 text-sm font-semibold text-white shadow-float transition hover:opacity-95"
          style={{
            backgroundImage: theme.buttonGradient,
            boxShadow: `0 22px 36px -22px ${theme.accentShadowStrong}`
          }}
          to="/registro-comercio"
        >
          Quiero sumar mi comercio
        </Link>
      </div>
    </section>
  );
}

