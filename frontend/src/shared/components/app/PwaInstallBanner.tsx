import { useState } from "react";
import { useUiStore } from "../../stores";

export function PwaInstallBanner() {
  const installPromptEvent = useUiStore((state) => state.installPromptEvent);
  const setInstallPromptEvent = useUiStore((state) => state.setInstallPromptEvent);
  const [loading, setLoading] = useState(false);

  if (!installPromptEvent) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-[28px] bg-ink p-4 text-white shadow-[0_26px_60px_rgba(24,19,18,0.32)]">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-200">App</p>
      <p className="mt-2 text-sm leading-6 text-white/80">
        Instala Kepedimos para abrir la app mas rapido y seguir tus pedidos desde cualquier momento.
      </p>
      <div className="mt-3 flex gap-2">
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
          className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white"
        >
          {loading ? "Abriendo..." : "Instalar"}
        </button>
        <button
          type="button"
          onClick={() => setInstallPromptEvent(null)}
          className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/80"
        >
          Mas tarde
        </button>
      </div>
    </div>
  );
}
