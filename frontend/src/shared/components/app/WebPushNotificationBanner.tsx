import { Bell, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useWebPushSubscription } from "../../hooks";
import { useUiStore } from "../../stores";

const DISMISSED_STORAGE_KEY = "kepedimos.web-push-banner.dismissed";

function dismissedStorageKey(userId: number | null): string | null {
  return userId == null ? null : `${DISMISSED_STORAGE_KEY}.${userId}`;
}

function readDismissed(userId: number | null): boolean {
  const key = dismissedStorageKey(userId);
  if (!key || typeof window === "undefined") return false;
  return window.localStorage.getItem(key) === "true";
}

export function WebPushNotificationBanner({ token, userId }: { token: string | null; userId: number | null }) {
  const { available, error, loading, permission, subscribe, subscribed, supported } = useWebPushSubscription(token);
  const installPromptEvent = useUiStore((state) => state.installPromptEvent);
  const [dismissed, setDismissed] = useState(() => readDismissed(userId));

  useEffect(() => {
    setDismissed(readDismissed(userId));
  }, [userId]);

  if (!token || !available || !supported || permission === "denied" || subscribed || dismissed) {
    return null;
  }

  const dismiss = () => {
    const key = dismissedStorageKey(userId);
    if (key && typeof window !== "undefined") {
      window.localStorage.setItem(key, "true");
    }
    setDismissed(true);
  };
  const bottomClassName = installPromptEvent ? "bottom-[12.5rem] sm:bottom-[10.5rem]" : "bottom-4";

  return (
    <div className={`kp-install-banner fixed ${bottomClassName} left-4 right-4 z-50 mx-auto max-w-xl p-4 sm:p-5`}>
      <div className="flex items-start gap-4">
        <span className="kp-install-icon hidden h-12 w-12 shrink-0 items-center justify-center border border-[rgba(255,106,26,0.24)] bg-[var(--kp-accent-soft)] text-[var(--kp-accent)] sm:inline-flex">
          <Bell className="h-6 w-6" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--kp-accent)]">Notificaciones</p>
          <p className="mt-2 text-sm leading-6 text-[var(--kp-ink-soft)]">
            Activa avisos para seguir pedidos, entregas y novedades importantes aun cuando no tengas la app abierta.
          </p>
          {error ? <p className="mt-2 text-xs font-semibold text-rose-700">{error}</p> : null}
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={loading}
          onClick={() => void subscribe()}
          className="app-button min-h-[48px] px-4 py-2 text-sm"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Bell className="h-4 w-4" aria-hidden="true" />}
          {loading ? "Activando..." : "Activar avisos"}
        </button>
        <button type="button" onClick={dismiss} className="kp-soft-action min-h-[48px] px-4 py-2 text-sm">
          <X className="h-4 w-4" aria-hidden="true" />
          Mas tarde
        </button>
      </div>
    </div>
  );
}
