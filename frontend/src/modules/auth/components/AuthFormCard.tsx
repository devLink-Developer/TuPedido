import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthSession } from "../../../shared/hooks";
import { Button } from "../../../shared/ui/Button";
import { roleToHomePath } from "../../../shared/utils/routing";

export function AuthFormCard({ mode }: { mode: "login" | "register" }) {
  const { login, register, loading } = useAuthSession();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = new URLSearchParams(location.search).get("redirectTo");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const profile = mode === "login" ? await login(email, password) : await register(fullName, email, password);
      if (profile.must_change_password) {
        const next = redirectTo ? `/cambiar-contrasena?redirectTo=${encodeURIComponent(redirectTo)}` : "/cambiar-contrasena";
        navigate(next, { replace: true });
        return;
      }
      navigate(redirectTo || roleToHomePath[profile.role], { replace: true });
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "No se pudo completar el acceso");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="rounded-[32px] bg-[linear-gradient(180deg,#221816_0%,#171210_100%)] p-5 text-white shadow-lift sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-200">Kepedimos</p>
        <h1 className="mt-3 font-display text-[2rem] font-bold leading-[1.05] tracking-tight sm:text-4xl">
          {mode === "login" ? "Ingresar a Kepedimos" : "Crear cuenta cliente"}
        </h1>
        {mode === "register" ? (
          <>
            <p className="mt-3 text-sm leading-6 text-white/72 sm:leading-7">
              Ingresa una sola vez y te llevamos a la experiencia correspondiente para tu cuenta.
            </p>
            <div className="mt-6 grid gap-3 text-sm leading-6 text-white/78">
              <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">
                Un solo acceso para clientes, comercios, riders y administradores.
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">
                El registro desde esta pantalla esta disponible para cuentas cliente.
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">
                Si estabas completando una solicitud, podras retomarla al volver.
              </div>
            </div>
          </>
        ) : null}
      </div>

      <form onSubmit={(event) => void handleSubmit(event)} className="rounded-[32px] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">
              {mode === "login" ? "Acceso" : "Registro"}
            </p>
            <h2 className="mt-2 font-display text-[1.85rem] font-bold leading-[1.08] tracking-tight text-ink sm:text-3xl">
              {mode === "login" ? "Iniciar sesion" : "Crear cuenta"}
            </h2>
          </div>
          <Link
            className="w-full rounded-full border border-black/10 bg-zinc-50 px-4 py-2 text-center text-sm font-semibold text-zinc-700 sm:w-auto"
            to={mode === "login" ? "/registro" : "/login"}
          >
            {mode === "login" ? "Crear cuenta" : "Ya tengo cuenta"}
          </Link>
        </div>

        <div className="mt-6 space-y-4">
          {mode === "register" ? (
            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Nombre completo</span>
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
                className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 outline-none focus:border-brand-500"
              />
            </label>
          ) : null}

          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 outline-none focus:border-brand-500"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Contrasena</span>
            <div className="flex items-center gap-2 rounded-2xl border border-black/10 bg-zinc-50 px-4 py-1.5">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
                className="min-w-0 flex-1 bg-transparent py-3 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600"
              >
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </label>
        </div>

        {error ? <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

        <Button type="submit" className="mt-5 w-full" disabled={submitting || loading}>
          {submitting || loading ? "Procesando..." : mode === "login" ? "Ingresar" : "Crear cuenta"}
        </Button>
      </form>
    </div>
  );
}
