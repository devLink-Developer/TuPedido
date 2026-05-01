import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthSession } from "../../../shared/hooks";
import { Button } from "../../../shared/ui/Button";
import { normalizePath, roleToHomePath } from "../../../shared/utils/routing";

export function ForcePasswordChangeCard() {
  const { user, changePassword, loading, logout } = useAuthSession();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = new URLSearchParams(location.search).get("redirectTo");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("La nueva contrasena y su confirmacion no coinciden.");
      return;
    }

    if (currentPassword === newPassword) {
      setError("La nueva contrasena debe ser distinta de la temporal.");
      return;
    }

    setSubmitting(true);
    try {
      const profile = await changePassword(currentPassword, newPassword);
      navigate(normalizePath(redirectTo || roleToHomePath[profile.role]), { replace: true });
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "No se pudo actualizar la contrasena");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[0.96fr_1.04fr]">
      <form onSubmit={(event) => void handleSubmit(event)} className="app-panel order-1 p-5 sm:p-6">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Cambio obligatorio</p>
            <h2 className="mt-2 font-display text-[1.9rem] font-bold leading-[1.04] tracking-tight text-ink sm:text-3xl">
              Actualiza tu acceso
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              logout();
              navigate("/login", { replace: true });
            }}
            className="kp-soft-action min-h-[44px] w-full px-4 py-2 text-center text-sm uppercase tracking-[0.16em] sm:w-auto"
          >
            Cerrar sesion
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Contrasena actual</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
              minLength={6}
              className="app-input"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Nueva contrasena</span>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
              minLength={6}
              className="app-input"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Repite la nueva contrasena</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              minLength={6}
              className="app-input"
            />
          </label>
        </div>

        {error ? <p className="mt-4 border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

        <Button type="submit" className="mt-5 w-full" disabled={submitting || loading}>
          {submitting || loading ? "Actualizando..." : "Guardar nueva contrasena"}
        </Button>
      </form>

      <div className="kp-install-banner order-2 p-5 sm:p-6">
        <p className="app-chip text-[var(--kp-accent)]">Seguridad</p>
        <h1 className="mt-4 font-display text-[2rem] font-bold leading-[1.03] tracking-tight text-ink sm:text-4xl">
          Cambia tu contrasena para continuar
        </h1>
        <p className="mt-3 text-sm leading-7 text-zinc-600">
          Restablecimos el acceso de {user?.full_name ?? "tu cuenta"}. Antes de seguir debes definir una nueva
          contrasena personal.
        </p>
        <div className="mt-6 grid gap-3 text-sm leading-6 text-zinc-700">
          <div className="border border-[var(--kp-stroke)] bg-white/82 px-4 py-4" style={{ borderRadius: 18 }}>
            Ingresa la contrasena temporal que recibiste. Desde el panel admin se restablece como <strong>12345678</strong>.
          </div>
          <div className="border border-[var(--kp-stroke)] bg-white/82 px-4 py-4" style={{ borderRadius: 18 }}>
            Cuando confirmes la nueva contrasena, recuperas el acceso normal a tu cuenta.
          </div>
        </div>
      </div>
    </div>
  );
}
