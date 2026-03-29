import type { PropsWithChildren } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { LoadingCard } from "../../shared/components";
import { useAuthSession } from "../../shared/hooks";
import type { Role } from "../../shared/types";
import { normalizePath, roleToHomePath } from "../../shared/utils/routing";

function buildRedirectTo(location: ReturnType<typeof useLocation>) {
  return `${location.pathname}${location.search}${location.hash}`;
}

function buildPasswordChangeRedirect(redirectTo: string) {
  return `/cambiar-contrasena?redirectTo=${encodeURIComponent(redirectTo)}`;
}

function AuthPending({ label }: { label: string }) {
  return (
    <div className="ambient-grid min-h-screen px-4 py-6 md:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <LoadingCard label={label} />
      </div>
    </div>
  );
}

export function GuestOnlyRoute({ children }: PropsWithChildren) {
  const { hydrated, loading, isAuthenticated, user } = useAuthSession();

  if (!hydrated || loading) {
    return <AuthPending label="Validando sesion..." />;
  }

  if (isAuthenticated && user) {
    if (user.must_change_password) {
      return <Navigate to="/cambiar-contrasena" replace />;
    }
    return <Navigate to={roleToHomePath[user.role]} replace />;
  }

  return <>{children}</>;
}

export function RequireRoles({ roles }: { roles: Role[] }) {
  const location = useLocation();
  const { hydrated, loading, isAuthenticated, user } = useAuthSession();

  if (!hydrated || loading) {
    return <AuthPending label="Cargando acceso..." />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to={`/login?redirectTo=${encodeURIComponent(buildRedirectTo(location))}`} replace />;
  }

  if (user.must_change_password) {
    return <Navigate to={buildPasswordChangeRedirect(buildRedirectTo(location))} replace />;
  }

  if (!roles.includes(user.role)) {
    return <Navigate to={roleToHomePath[user.role]} replace />;
  }

  return <Outlet />;
}

export function PasswordChangeRoute({ children }: PropsWithChildren) {
  const location = useLocation();
  const { hydrated, loading, isAuthenticated, user } = useAuthSession();

  if (!hydrated || loading) {
    return <AuthPending label="Validando seguridad..." />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to={`/login?redirectTo=${encodeURIComponent(buildRedirectTo(location))}`} replace />;
  }

  if (!user.must_change_password) {
    const redirectTo = new URLSearchParams(location.search).get("redirectTo");
    return <Navigate to={normalizePath(redirectTo || roleToHomePath[user.role])} replace />;
  }

  return <>{children}</>;
}
