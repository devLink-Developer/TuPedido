import { useEffect } from "react";
import { useUiStore } from "../../stores";

export function ToastViewport() {
  const toasts = useUiStore((state) => state.toasts);
  const dismissToast = useUiStore((state) => state.dismissToast);

  useEffect(() => {
    if (!toasts.length) return;
    const timer = window.setTimeout(() => {
      dismissToast(toasts[0].id);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [dismissToast, toasts]);

  if (!toasts.length) return null;

  return (
    <div className="fixed right-4 top-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div key={toast.id} className="kp-toast px-4 py-3 text-sm font-semibold text-[var(--kp-ink-strong)]">
          {toast.title}
        </div>
      ))}
    </div>
  );
}
