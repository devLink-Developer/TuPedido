import { Link } from "react-router-dom";

export function CTARider() {
  return (
    <section className="rounded-[32px] bg-[linear-gradient(135deg,#0f1f1b_0%,#132c24_100%)] p-6 text-white shadow-lift">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#9be3c1]/70">Rider</p>
      <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">Reparte con una app hecha para moverte mejor</h2>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-white/72">
        Los riders ahora se incorporan directamente desde cada comercio y reciben acceso para operar pedidos ya asignados.
      </p>
      <Link className="mt-4 inline-flex rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-float" to="/login">
        Ya tengo acceso
      </Link>
    </section>
  );
}
