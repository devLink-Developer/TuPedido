import type { Category } from "../../../shared/types";
import type { LandingTheme } from "../utils/landingTheme";

const benefits = [
  {
    label: "Todo cerca",
    description: "Encuentra comercios de tu zona sin ir saltando entre distintas aplicaciones o busquedas."
  },
  {
    label: "Decide mas rapido",
    description: "Descubre opciones claras para comparar y elegir lo que mas te conviene en ese momento."
  },
  {
    label: "A tu manera",
    description: "Pide con envio o retiro segun tu tiempo, tu urgencia y el tipo de compra que quieras hacer."
  },
  {
    label: "Mas tranquilidad",
    description: "Compra con una experiencia simple, ordenada y pensada para que todo se sienta facil."
  }
];

export function BenefitsSection({
  selectedCategory,
  theme
}: {
  selectedCategory: Category | null;
  theme: LandingTheme;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">
            {selectedCategory ? `Beneficios de ${selectedCategory.name}` : "Beneficios para ti"}
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink">
            {selectedCategory
              ? `Pedir ${selectedCategory.name.toLowerCase()} puede ser asi de simple`
              : "Todo pensado para que pedir sea mas facil"}
          </h2>
        </div>
        {selectedCategory ? (
          <span
            className="inline-flex rounded-full border px-4 py-2 text-sm font-semibold"
            style={{ borderColor: theme.accentBorderStrong, backgroundColor: theme.accentSoft, color: theme.accent }}
          >
            Ideal para hoy: {selectedCategory.name}
          </span>
        ) : null}
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        {benefits.map((item, index) => (
          <article
            key={item.label}
            className="rounded-[28px] border p-5 shadow-sm transition-[background,border-color,box-shadow] duration-300"
            style={{
              background: index === 0 ? theme.softPanelGradient : "#FFFFFF",
              borderColor: index === 0 ? theme.accentBorderStrong : theme.accentBorder,
              boxShadow: index === 0 ? `0 20px 40px -34px ${theme.accentShadow}` : undefined
            }}
          >
            <div className="flex items-start gap-4">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black text-white"
                style={{ background: index === 0 ? theme.buttonGradient : `linear-gradient(135deg,${theme.accent}88,${theme.accent}44)` }}
              >
                {index + 1}
              </span>
              <div>
                <p
                  className="text-xs font-semibold uppercase tracking-[0.2em]"
                  style={{ color: index === 0 ? theme.accent : "#9CA3AF" }}
                >
                  {item.label}
                </p>
                <p className="mt-2 text-sm leading-7 text-zinc-700">{item.description}</p>
              </div>
            </div>
          </article>
        ))}
      </section>
    </section>
  );
}
