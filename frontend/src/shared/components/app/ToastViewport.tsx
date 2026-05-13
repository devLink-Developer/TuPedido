import { useEffect } from "react";
import { useUiStore } from "../../stores";

export function ToastViewport() {
  const toasts = useUiStore((state) => state.toasts);
  const dismissToast = useUiStore((state) => state.dismissToast);
  const activeToast = toasts[0];

  useEffect(() => {
    if (!activeToast) return;
    const timer = window.setTimeout(() => {
      dismissToast(activeToast.id);
    }, activeToast.durationMs);
    return () => window.clearTimeout(timer);
  }, [activeToast, dismissToast]);

  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 max-w-[calc(100vw-2rem)] space-y-2 sm:right-5 sm:top-5">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          aria-live="polite"
          className="kp-toast max-w-xs truncate px-4 py-3 text-sm font-semibold text-[var(--kp-ink-strong)]"
        >
          {toast.title}
        </div>
      ))}
    </div>
  );
}
