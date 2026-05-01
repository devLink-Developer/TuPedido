import type { PropsWithChildren } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "../../shared/components";
import { KE_BRAND_NAME } from "../../shared/config/brand";

export function LandingLayout({ children }: PropsWithChildren) {
  return (
    <div className="kp-landing-root min-h-screen text-ink">
      <header className="kp-site-header">
        <div className="kp-shell kp-header-shell">
          <Link to="/" aria-label={`Ir al inicio de ${KE_BRAND_NAME}`} className="kp-brand-link">
            <BrandMark imageClassName="kp-header-brand" />
          </Link>
          <nav className="kp-site-nav" aria-label="Navegacion principal">
            <a href="#comercios">Comercios</a>
            <a href="#como-funciona">Como funciona</a>
            <a href="#ayuda">Ayuda</a>
          </nav>
          <div className="kp-header-actions">
            <Link className="kp-button kp-button-outline" to="/login">
              Ingresar
            </Link>
            <Link className="kp-button kp-button-primary" to="/registro">
              Crear cuenta
            </Link>
          </div>
        </div>
      </header>
      <main className="kp-landing-main">{children}</main>
    </div>
  );
}
