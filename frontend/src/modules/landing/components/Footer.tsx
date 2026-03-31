import { Link } from "react-router-dom";
import { PlatformWordmark } from "../../../shared/components";

export function Footer() {
  return (
    <footer className="rounded-[32px] bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <PlatformWordmark
            imageClassName="h-5 w-auto max-w-[7rem] object-contain"
            textClassName="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400"
          />
          <p className="mt-2 text-sm text-zinc-600">Soluciones para clientes y comercios en una misma plataforma.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-full border border-black/10 bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-700" to="/c">
            Comprar
          </Link>
          <Link className="rounded-full border border-black/10 bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-700" to="/registro-comercio">
            Sumar comercio
          </Link>
        </div>
      </div>
    </footer>
  );
}
