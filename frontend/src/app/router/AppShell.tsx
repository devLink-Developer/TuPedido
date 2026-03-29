import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { PwaInstallBanner, ToastViewport } from "../../shared/components";
import { usePwaInstallPrompt } from "../../shared/hooks";
import { useAuthStore, useCartStore, useCategoryStore } from "../../shared/stores";
import { normalizePath, roleToHomePath } from "../../shared/utils/routing";

function buildRedirectTarget(location: ReturnType<typeof useLocation>, role: string) {
  const params = new URLSearchParams(location.search);
  const requestRedirect = params.get("redirectTo");

  if ((location.pathname === "/login" || location.pathname === "/registro") && requestRedirect) {
    return normalizePath(requestRedirect);
  }

  if (location.pathname === "/" || location.pathname === "/login" || location.pathname === "/registro") {
    return roleToHomePath[role as keyof typeof roleToHomePath];
  }

  return `${location.pathname}${location.search}${location.hash}`;
}

export function AppShell() {
  const location = useLocation();
  const hydrate = useAuthStore((state) => state.hydrate);
  const hydrated = useAuthStore((state) => state.hydrated);
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const refreshCart = useCartStore((state) => state.refreshCart);
  const resetCart = useCartStore((state) => state.reset);
  const loadCategories = useCategoryStore((state) => state.loadCategories);

  usePwaInstallPrompt();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    if (!hydrated) return;

    if (token && user) {
      void refreshCart();
      return;
    }

    resetCart();
  }, [hydrated, refreshCart, resetCart, token, user]);

  if (hydrated && token && user?.must_change_password && location.pathname !== "/cambiar-contrasena") {
    const redirectTo = buildRedirectTarget(location, user.role);
    return <Navigate to={`/cambiar-contrasena?redirectTo=${encodeURIComponent(redirectTo)}`} replace />;
  }

  return (
    <>
      <Outlet />
      <ToastViewport />
      <PwaInstallBanner />
    </>
  );
}
