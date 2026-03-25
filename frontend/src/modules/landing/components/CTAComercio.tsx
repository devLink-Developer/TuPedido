import { Link } from "react-router-dom";

export function CTAComercio() {
  return (
    <section className="rounded-[32px] bg-[linear-gradient(135deg,#221816_0%,#171210_100%)] p-6 text-white shadow-lift">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-200">Comercio</p>
      <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">Activa tu operación en /m</h2>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-white/72">
        Completa tu postulación pública y continúa el alta cuando tengas sesión. La operación diaria vive aislada del resto de roles.
      </p>
      <Link className="mt-4 inline-flex rounded-full bg-brand-500 px-5 py-3 text-sm font-semibold text-white shadow-float" to="/registro-comercio">
        Ir a /registro-comercio
      </Link>
    </section>
  );
}
