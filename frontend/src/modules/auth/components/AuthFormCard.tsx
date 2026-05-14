import { useState, type FormEvent } from "react";
import {
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
  User
} from "lucide-react";
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
  const isLogin = mode === "login";
  const titleId = `${mode}-auth-title`;
  const fullNameId = `${mode}-full-name`;
  const emailId = `${mode}-email`;
  const passwordId = `${mode}-password`;
  const isBusy = submitting || loading;
  const passwordToggleLabel = showPassword ? "Ocultar clave" : "Mostrar clave";

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

  const formFields = (
    <div className="mt-6 space-y-4">
      {mode === "register" ? (
        <div className="auth-field">
          <label className="auth-field-label" htmlFor={fullNameId}>
            Nombre completo
          </label>
          <div className="auth-input-shell">
            <User aria-hidden="true" className="auth-input-icon" />
            <input
              id={fullNameId}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
              autoComplete="name"
              className="auth-input-control"
            />
          </div>
        </div>
      ) : null}

      <div className="auth-field">
        <label className="auth-field-label" htmlFor={emailId}>
          Email
        </label>
        <div className="auth-input-shell">
          <Mail aria-hidden="true" className="auth-input-icon" />
          <input
            id={emailId}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
            inputMode="email"
            className="auth-input-control"
          />
        </div>
      </div>

      <div className="auth-field">
        <label className="auth-field-label" htmlFor={passwordId}>
          Contrasena
        </label>
        <div className="auth-input-shell">
          <LockKeyhole aria-hidden="true" className="auth-input-icon" />
          <input
            id={passwordId}
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={6}
            autoComplete={isLogin ? "current-password" : "new-password"}
            className="auth-input-control"
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            className="auth-password-toggle"
            aria-label={passwordToggleLabel}
            aria-pressed={showPassword}
            title={passwordToggleLabel}
          >
            {showPassword ? (
              <EyeOff aria-hidden="true" className="h-5 w-5" />
            ) : (
              <Eye aria-hidden="true" className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );

  const formActions = (
    <>
      {error ? (
        <p className="auth-error-message mt-4" role="alert" aria-live="polite">
          {error}
        </p>
      ) : null}

      <Button type="submit" className="auth-primary-button mt-5 w-full" disabled={isBusy}>
        {isBusy ? (
          <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />
        ) : (
          <ShieldCheck aria-hidden="true" className="h-5 w-5" />
        )}
        <span>{isBusy ? "Procesando..." : mode === "login" ? "Ingresar" : "Crear cuenta"}</span>
      </Button>

      <div className="auth-secondary-block mt-5 text-center">
        <p className="text-sm text-zinc-500">{content.secondaryPrompt}</p>
        <Link
          className="auth-secondary-action mt-3 inline-flex"
          to={content.secondaryActionTo}
        >
          {content.secondaryActionLabel}
        </Link>
      </div>
    </>
  );

  if (isLogin) {
    return (
      <section className="app-panel auth-form-panel mx-auto w-full max-w-lg overflow-hidden" aria-labelledby={titleId}>
        <div className="auth-form-header">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="auth-kicker">{content.eyebrow}</p>
              <h1 id={titleId} className="mt-3 font-display text-[1.85rem] font-bold leading-[1.02] text-ink sm:text-[2.15rem]">
                {content.formTitle}
              </h1>
              <p className="mt-3 max-w-md text-sm leading-6 text-zinc-600">{content.formDescription}</p>
            </div>
            <BrandWordmark
              brandName={brandName}
              wordmarkUrl={wordmarkUrl}
              size="inline"
              fit="contain"
              className="hidden min-w-0 shrink-0 sm:inline-flex"
              frameClassName="h-8 w-[9.5rem] sm:h-9 sm:w-[10.5rem]"
            />
          </div>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="auth-form-body">
          {formFields}
          {formActions}
        </form>
      </section>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[0.96fr_1.04fr]">
      <form onSubmit={(event) => void handleSubmit(event)} className="app-panel order-1 p-5 sm:p-6">
        <div className="relative min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">{content.formEyebrow}</p>
          <h2 id={titleId} className="mt-2 font-display text-[1.85rem] font-bold leading-[1.04] tracking-tight text-ink sm:text-3xl">
            {content.formTitle}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-7 text-zinc-500">{content.formDescription}</p>
        </div>

        {formFields}
        {formActions}
      </form>

      <div className="kp-install-banner order-2 p-5 sm:p-6">
        <p className="app-chip text-[var(--kp-accent)]">{content.eyebrow}</p>
        <h1 className="mt-4 font-display text-[2rem] font-bold leading-[1.03] tracking-tight text-ink sm:text-4xl">{content.titlePrefix}</h1>
        <p className="mt-3 max-w-xl text-sm leading-7 text-zinc-600 sm:text-[15px]">
          {content.description}
        </p>
        <div className="mt-6 grid gap-3 text-sm leading-6 text-zinc-700">
          {content.highlights.map((item, index) => (
            <div key={item} className="border border-[var(--kp-stroke)] bg-white/82 px-4 py-4" style={{ borderRadius: 18 }}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--kp-accent)]">Paso {index + 1}</p>
              <p className="mt-2">{item}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
