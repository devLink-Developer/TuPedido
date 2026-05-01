import type { PropsWithChildren } from "react";
import { Link, useLocation } from "react-router-dom";
import { BrandMark } from "../../shared/components";
import { KE_BRAND_NAME } from "../../shared/config/brand";

export function AuthLayout({ children }: PropsWithChildren) {
  const location = useLocation();
  const isLoginRoute = location.pathname === "/login";
  const isRegisterRoute = location.pathname === "/registro";

  return (
    <div className="app-shell min-h-screen text-ink">
      <header className="sticky top-0 z-30">
        <div className="app-toolbar w-full border-x-0">
          <div className="mx-auto flex min-h-[76px] w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-8">
            <Link to="/" aria-label={`Ir al inicio de ${KE_BRAND_NAME}`} className="inline-flex items-center">
              <BrandMark imageClassName="h-11 w-[10.25rem] sm:h-12 sm:w-[11.5rem]" />
            </Link>
            <div className="flex items-center gap-2">
              {!isLoginRoute ? (
                <Link
                  className="kp-soft-action min-h-[48px] px-4 py-2 text-sm"
                  to="/login"
                >
                  Ingresar
                </Link>
              ) : null}
              {!isRegisterRoute ? (
                <Link className="app-button px-4 py-2 text-sm" to="/registro">
                  Crear cuenta
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
