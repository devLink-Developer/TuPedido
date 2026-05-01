import { Download, Smartphone, X } from "lucide-react";
import { useState } from "react";
import { PlatformWordmark } from "./PlatformWordmark";
import { useUiStore } from "../../stores";

export function PwaInstallBanner() {
  const installPromptEvent = useUiStore((state) => state.installPromptEvent);
  const setInstallPromptEvent = useUiStore((state) => state.setInstallPromptEvent);
  const [loading, setLoading] = useState(false);

  if (!installPromptEvent) return null;

  return (
    <div className="kp-install-banner fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-xl p-4 sm:p-5">
      <div className="flex items-start gap-4">
        <span className="kp-install-icon hidden h-12 w-12 shrink-0 items-center justify-center border border-[rgba(255,106,26,0.24)] bg-[var(--kp-accent-soft)] text-[var(--kp-accent)] sm:inline-flex">
          <Smartphone className="h-6 w-6" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--kp-accent)]">App</p>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-6 text-[var(--kp-ink-soft)]">
            <span>Instala</span>
            <PlatformWordmark size="inline" frameClassName="w-[8.75rem]" textClassName="text-sm" />
            <span>para abrir mas rapido y seguir tus pedidos desde cualquier momento.</span>
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            await installPromptEvent.prompt();
            await installPromptEvent.userChoice;
            setInstallPromptEvent(null);
            setLoading(false);
          }}
          className="app-button min-h-[48px] px-4 py-2 text-sm"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          {loading ? "Abriendo..." : "Instalar"}
        </button>
        <button
          type="button"
          onClick={() => setInstallPromptEvent(null)}
          className="kp-soft-action min-h-[48px] px-4 py-2 text-sm"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          Mas tarde
        </button>
      </div>
    </div>
  );
}
