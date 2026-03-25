const benefits = [
  "Cliente navega por /c con catálogo público y checkout protegido.",
  "Comercio opera su backoffice en /m con productos, pedidos y configuración.",
  "Rider gestiona disponibilidad, entregas activas e historial en /r.",
  "Admin centraliza aprobaciones, operación y configuración en /a."
];

export function BenefitsSection() {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      {benefits.map((item, index) => (
        <article key={item} className="rounded-[28px] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Beneficio {index + 1}</p>
          <p className="mt-3 text-sm leading-7 text-zinc-700">{item}</p>
        </article>
      ))}
    </section>
  );
}
