import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BrandWordmark } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import { usePlatformBranding } from "../../../shared/providers/PlatformBrandingProvider";
import { Button } from "../../../shared/ui/Button";
import { roleToHomePath } from "../../../shared/utils/routing";

const authMarketingContent = {
  login: {
    eyebrow: "Acceso",
    titlePrefix: "Ingresar a",
    description: "Entra y pide mas rapido en los comercios que ya conoces.",
    highlights: [
      "Guarda tu direccion y evita cargar lo mismo en cada pedido.",
      "Vuelve a comprar tus favoritos sin empezar de cero.",
      "Sigue tus pedidos desde un solo lugar."
    ],
    formEyebrow: "Acceso",
    formTitle: "Iniciar sesion",
    formDescription: "Entra para ver tus pedidos y comprar sin vueltas.",
    secondaryPrompt: "No tienes cuenta?",
    secondaryActionLabel: "Crear cuenta",
    secondaryActionTo: "/registro"
  },
  register: {
    eyebrow: "Registro cliente",
    titlePrefix: "Tu proximo pedido empieza aqui",
    description: "Crea tu cuenta y deja todo listo para pedir mas rapido la proxima vez.",
    highlights: [
      "Guarda tu direccion una sola vez.",
      "Haz seguimiento de tus pedidos cuando quieras.",
      "Vuelve a comprar sin perder tiempo."
    ],
    formEyebrow: "Registro",
    formTitle: "Crear cuenta",
    formDescription: "Completa tus datos y empieza a pedir en minutos.",
    secondaryPrompt: "Ya tienes cuenta?",
    secondaryActionLabel: "Iniciar sesion",
    secondaryActionTo: "/login"
  }
} as const;

export function AuthFormCard({ mode }: { mode: "login" | "register" }) {
  const { login, register, loading } = useAuthSession();
  const { brandName, wordmarkUrl } = usePlatformBranding();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = new URLSearchParams(location.search).get("redirectTo");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const content = authMarketingContent[mode];

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
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-200">{content.eyebrow}</p>
        <h1 className="mt-3 font-display text-[2rem] font-bold leading-[1.05] tracking-tight sm:text-4xl">
          {mode === "login" ? (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:gap-x-4">
              <span>{content.titlePrefix}</span>
              <BrandWordmark
                brandName={brandName}
                wordmarkUrl={wordmarkUrl}
                size="hero"
                fit="contain"
                className="min-w-0 shrink-0"
                frameClassName="h-[5.25rem] w-[15rem] sm:h-[6.5rem] sm:w-[18rem]"
              />
            </span>
          ) : (
            content.titlePrefix
          )}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-white/72 sm:text-[15px] sm:leading-7">
          {content.description}
        </p>
        <div className="mt-6 grid gap-3 text-sm leading-6 text-white/78">
          {content.highlights.map((item) => (
            <div key={item} className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">
              {item}
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={(event) => void handleSubmit(event)} className="rounded-[32px] bg-white p-5 shadow-sm sm:p-6">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">{content.formEyebrow}</p>
          <h2 className="mt-2 font-display text-[1.85rem] font-bold leading-[1.08] tracking-tight text-ink sm:text-3xl">
            {content.formTitle}
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500">{content.formDescription}</p>
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

        <div className="mt-5 border-t border-black/6 pt-5 text-center">
          <p className="text-sm text-zinc-500">{content.secondaryPrompt}</p>
          <Link
            className="mt-3 inline-flex rounded-full border border-black/10 bg-zinc-50 px-5 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-brand-200 hover:text-ink"
            to={content.secondaryActionTo}
          >
            {content.secondaryActionLabel}
          </Link>
        </div>
      </form>
    </div>
  );
}
