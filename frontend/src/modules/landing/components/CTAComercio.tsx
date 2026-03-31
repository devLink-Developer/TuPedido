import { Link } from "react-router-dom";
import { PlatformWordmark } from "../../../shared/components";

export function CTAComercio() {
  return (
    <section className="rounded-[32px] bg-[linear-gradient(135deg,#221816_0%,#171210_100%)] p-6 text-white shadow-lift">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-200">Comercio</p>
      <h2 className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 font-display text-3xl font-bold tracking-tight">
        <span>Haz crecer tu negocio con</span>
        <PlatformWordmark
          frameClassName="h-10 w-[8.25rem] overflow-hidden"
          imageClassName="h-full w-full object-cover object-center"
          textClassName="text-3xl"
        />
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-white/72">
        Suma tu local, publica tu catalogo y empieza a recibir pedidos con una experiencia pensada para vender mas cada dia.
      </p>
      <Link className="mt-4 inline-flex rounded-full bg-brand-500 px-5 py-3 text-sm font-semibold text-white shadow-float" to="/registro-comercio">
        Quiero sumar mi comercio
      </Link>
    </section>
  );
}
