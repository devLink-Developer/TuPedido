import type { PropsWithChildren } from "react";
import { Link } from "react-router-dom";

export function LandingLayout({ children }: PropsWithChildren) {
  return (
    <div className="ambient-grid min-h-screen text-ink">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-[rgba(255,251,246,0.88)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-8">
          <Link to="/" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-[1.2rem] bg-[linear-gradient(135deg,#fb923c,#c2410c)] text-sm font-bold text-white shadow-float">
              TP
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-400">App</p>
              <p className="font-display text-lg font-bold tracking-tight">TuPedido</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Link className="rounded-full border border-black/10 bg-white/80 px-4 py-2 text-sm font-semibold text-zinc-700" to="/login">
              Ingresar
            </Link>
            <Link className="rounded-full bg-[linear-gradient(135deg,#fb923c,#c2410c)] px-4 py-2 text-sm font-semibold text-white shadow-float" to="/registro">
              Crear cuenta
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
