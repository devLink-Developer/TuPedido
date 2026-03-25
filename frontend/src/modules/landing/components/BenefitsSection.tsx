const benefits = [
  {
    label: "Compra sin vueltas",
    description: "Encuentra comercios cercanos, elige lo que necesitas y confirma tu pedido en pocos pasos."
  },
  {
    label: "Entrega con seguimiento",
    description: "Sigue cada pedido con claridad y recibe actualizaciones desde la compra hasta la entrega."
  },
  {
    label: "Mas ventas para tu comercio",
    description: "Impulsa tu negocio con un catalogo claro, pedidos organizados y una operacion diaria mas agil."
  },
  {
    label: "Reparto listo para crecer",
    description: "Activa riders, coordina entregas y manten toda la operacion en movimiento con una sola plataforma."
  }
];

export function BenefitsSection() {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      {benefits.map((item) => (
        <article key={item.label} className="rounded-[28px] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">{item.label}</p>
          <p className="mt-3 text-sm leading-7 text-zinc-700">{item.description}</p>
        </article>
      ))}
    </section>
  );
}
