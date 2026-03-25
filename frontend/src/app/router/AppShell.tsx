import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { PwaInstallBanner, ToastViewport } from "../../shared/components";
import { usePwaInstallPrompt } from "../../shared/hooks";
import { useAuthStore, useCartStore } from "../../shared/stores";

export function AppShell() {
  const hydrate = useAuthStore((state) => state.hydrate);
  const hydrated = useAuthStore((state) => state.hydrated);
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const refreshCart = useCartStore((state) => state.refreshCart);
  const resetCart = useCartStore((state) => state.reset);

  usePwaInstallPrompt();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;

    if (token && user) {
      void refreshCart();
      return;
    }

    resetCart();
  }, [hydrated, refreshCart, resetCart, token, user]);

  return (
    <>
      <Outlet />
      <ToastViewport />
      <PwaInstallBanner />
    </>
  );
}
