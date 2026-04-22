import type { LandingTheme } from "../utils/landingTheme";

const benefits = [
  {
    label: "Para el dia a dia",
    description: "Desde resolver la cena hasta una compra de ultimo momento, encuentras opciones cercanas en un solo lugar."
  },
  {
    label: "Menos friccion",
    description: "Buscas, comparas y decides sin perder tiempo entre pestanas, chats o publicaciones sueltas."
  },
  {
    label: "A tu ritmo",
    description: "Elige envio o retiro segun tu tiempo, tu urgencia y la forma en que prefieras resolverlo hoy."
  },
  {
    label: "Mas claridad",
    description: "La experiencia esta pensada para ayudarte a decidir rapido, incluso cuando vas con prisa."
  }
];

export function BenefitsSection({ theme }: { theme: LandingTheme }) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">Una experiencia mas seria</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink">
            Menos artificio visual. Mas claridad para decidir y avanzar.
          </h2>
          <p className="mt-3 text-sm leading-7 text-zinc-600">
            La interfaz ahora prioriza lectura, orden y contraste. La idea es que encuentres rapido lo que necesitas
            sin sentir que todo compite por llamar tu atencion.
          </p>
        </div>
        <span
          className="inline-flex border px-4 py-2 text-sm font-semibold"
          style={{ borderColor: theme.accentBorderStrong, backgroundColor: "#fffaf6", color: theme.accent }}
        >
          Profesional, simple y directo
        </span>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        {benefits.map((item, index) => (
          <article
            key={item.label}
            className="border bg-white p-5 transition-[border-color,box-shadow] duration-300"
            style={{
              borderColor: index === 0 ? theme.accentBorderStrong : "rgba(24,19,18,0.08)",
              boxShadow: index === 0 ? `0 14px 30px -26px ${theme.accentShadow}` : "0 10px 24px -24px rgba(24,19,18,0.1)"
            }}
          >
            <div className="flex items-start gap-4">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center border text-xs font-black"
                style={{
                  borderColor: index === 0 ? theme.accentBorderStrong : "rgba(24,19,18,0.12)",
                  backgroundColor: index === 0 ? "#fff7f1" : "#ffffff",
                  color: index === 0 ? theme.accent : "#6b5a50"
                }}
              >
                {index + 1}
              </span>
              <div>
                <p
                  className="text-xs font-semibold uppercase tracking-[0.2em]"
                  style={{ color: index === 0 ? theme.accent : "#7f6a5e" }}
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
