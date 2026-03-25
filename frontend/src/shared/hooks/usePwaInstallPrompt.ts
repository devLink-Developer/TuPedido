import { useEffect } from "react";
import type { BeforeInstallPromptEvent } from "../stores";
import { useUiStore } from "../stores";

export function usePwaInstallPrompt() {
  const setInstallPromptEvent = useUiStore((state) => state.setInstallPromptEvent);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPromptEvent(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstallPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [setInstallPromptEvent]);
}
