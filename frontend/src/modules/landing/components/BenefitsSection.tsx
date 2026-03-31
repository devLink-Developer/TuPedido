import type { Category } from "../../../shared/types";
import type { LandingTheme } from "../utils/landingTheme";

const benefits = [
  {
    label: "Compra sin vueltas",
    description: "Entras, encuentras el local indicado y pides sin perder tiempo entre opciones desordenadas."
  },
  {
    label: "Seguimiento claro",
    description: "Sabes en que etapa va tu pedido desde que compras hasta que llega."
  },
  {
    label: "Mas visibilidad",
    description: "Los comercios muestran mejor lo que venden y convierten mejor desde el primer vistazo."
  },
  {
    label: "Todo mas coherente",
    description: "Cada rubro tiene su propio contexto visual para que navegar se sienta mas claro y natural."
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
            {selectedCategory ? `Contexto ${selectedCategory.name}` : "Por que funciona"}
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink">
            {selectedCategory
              ? `Asi se siente navegar cuando eliges ${selectedCategory.name.toLowerCase()}`
              : "Una experiencia mas clara para comprar y vender"}
          </h2>
        </div>
        {selectedCategory ? (
          <span
            className="inline-flex rounded-full border px-4 py-2 text-sm font-semibold"
            style={{ borderColor: theme.accentBorderStrong, backgroundColor: theme.accentSoft, color: theme.accent }}
          >
            Rubro activo: {selectedCategory.name}
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
            <p
              className="text-xs font-semibold uppercase tracking-[0.2em]"
              style={{ color: index === 0 ? theme.accent : "#9CA3AF" }}
            >
              {item.label}
            </p>
            <p className="mt-3 text-sm leading-7 text-zinc-700">{item.description}</p>
          </article>
        ))}
      </section>
    </section>
  );
}

