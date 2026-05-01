import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, BadgePlus, Bike, Clock, Grid2X2, MapPin, Package, Search, ShoppingBag, Star, Store, UtensilsCrossed } from "lucide-react";
import { BrandMark, PlatformWordmark } from "../../../shared/components";
import { KE_LANDING_POSTER_URL } from "../../../shared/config/brand";

const categories = [
  { label: "Farmacia", query: "Farmacia", icon: BadgePlus, className: "kp-poster-pill-farmacia" },
  { label: "Almacén", query: "Almacen", icon: Store, className: "kp-poster-pill-almacen" },
  { label: "Comida", query: "Comida", icon: UtensilsCrossed, className: "kp-poster-pill-comida" },
  { label: "Bebidas", query: "Bebidas", icon: ShoppingBag, className: "kp-poster-pill-bebidas" },
  { label: "Más", query: "", icon: Grid2X2, className: "kp-poster-pill-mas" },
];

const detailItems = [
  ["1", "PARA EL DIA A DIA", "Desde resolver la cena hasta una compra de ultimo momento, encontras opciones cercanas en un solo lugar.", ShoppingBag],
  ["2", "MENOS FRICCION", "Buscas, comparas y decidis sin perder tiempo entre pestanas, chats o publicaciones sueltas.", Search],
  ["3", "A TU RITMO", "Elegi envio o retiro segun tu tiempo, tu urgencia y la forma en que prefieras resolverlo hoy.", Clock],
  ["4", "MAS CLARIDAD", "La experiencia esta pensada para ayudarte a decidir rapido, incluso cuando vas con prisa.", Star],
] as const;

const valueItems = [
  ["Comercios cercanos", "Descubri opciones reales cerca tuyo, sin moverte de casa.", MapPin],
  ["Envio o retiro", "Elegi la opcion que mejor se adapte a tu tiempo y tu dia.", Bike],
  ["Compara y elegi mejor", "Menos vueltas, mas claridad para decidir rapido.", Search],
] as const;

export function LandingPage() {
  const navigate = useNavigate();
  const [posterSearch, setPosterSearch] = useState("");
  const [mobileSearch, setMobileSearch] = useState("");

  function catalogUrl(query: string) {
    const normalized = query.trim();
    return normalized ? `/c?search=${encodeURIComponent(normalized)}` : "/c";
  }

  function submitPosterSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate(catalogUrl(posterSearch));
  }

  function submitMobileSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate(catalogUrl(mobileSearch));
  }

  function openCategory(query: string) {
    navigate(catalogUrl(query));
  }

  return (
    <div className="kp-landing">
      <section className="kp-hero-poster" aria-label="KePedimos">
        <div className="kp-hero-poster-crop">
          <div className="kp-hero-poster-media">
            <img
              className="kp-hero-poster-image"
              src={KE_LANDING_POSTER_URL}
              alt="Vista inicial de KePedimos con busqueda, mapa naranja y comercios cercanos."
              fetchPriority="high"
            />
            <div className="kp-hero-poster-ui" aria-label="Portada interactiva">
              <form className="kp-poster-search-bar" role="search" onSubmit={submitPosterSearch}>
                <label className="kp-poster-search-field">
                  <Search aria-hidden="true" />
                  <span className="sr-only">Buscar comercios o productos</span>
                  <input
                    name="q"
                    type="search"
                    value={posterSearch}
                    onChange={(event) => setPosterSearch(event.target.value)}
                    placeholder="Que necesitas hoy?"
                    autoComplete="off"
                  />
                </label>
                <button type="submit" className="kp-button kp-button-primary kp-poster-search-submit">
                  Buscar comercios
                </button>
              </form>

              <div className="kp-poster-pill-hotspots" aria-label="Categorias destacadas">
                {categories.map((category) => (
                  <button
                    key={category.label}
                    type="button"
                    onClick={() => openCategory(category.query)}
                    className={`kp-poster-hotspot ${category.className}`}
                    aria-label={`Buscar ${category.label}`}
                  >
                    {category.label}
                  </button>
                ))}
              </div>

              <Link to="/registro-comercio" className="kp-poster-hotspot kp-poster-shortcut-store">
                Soy comercio
              </Link>
              <Link to="/c?delivery=delivery" className="kp-poster-hotspot kp-poster-shortcut-delivery">
                Envio o retiro
              </Link>
              <button type="button" onClick={() => openCategory("Cena")} className="kp-poster-hotspot kp-poster-floating-dinner">
                Cena cerca
              </button>
              <button type="button" onClick={() => openCategory("Farmacia")} className="kp-poster-hotspot kp-poster-floating-pharmacy">
                Farmacia abierta
              </button>
              <Link to="/c?delivery=pickup" className="kp-poster-hotspot kp-poster-floating-pickup">
                Retiro disponible
              </Link>
              <Link to="/c" className="kp-poster-hotspot kp-poster-value-nearby">
                Comercios cercanos
              </Link>
              <Link to="/c?delivery=delivery" className="kp-poster-hotspot kp-poster-value-delivery">
                Envio o retiro
              </Link>
              <Link to="/c" className="kp-poster-hotspot kp-poster-value-compare">
                Compara y elegi mejor
              </Link>
            </div>
          </div>
        </div>
      </section>

      <span className="kp-section-anchor" id="comercios" aria-hidden="true" />

      <section className="kp-hero-mobile">
        <div className="kp-shell kp-hero-shell">
          <div className="kp-hero-copy">
            <PlatformWordmark size="hero" frameClassName="kp-mobile-wordmark" />
            <div className="kp-eyebrow">
              <span />
              HECHO PARA TU DIA A DIA
            </div>
            <h1>
              Pedi cerca.
              <br />
              Resolve rapido.
              <br />
              <span>Sin vueltas.</span>
            </h1>
            <p>Encontra comercios de tu zona, compara opciones y elegi envio o retiro en minutos.</p>

            <form className="kp-mobile-search" role="search" onSubmit={submitMobileSearch}>
              <label>
                <Search aria-hidden="true" />
                <span className="sr-only">Buscar comercios o productos</span>
                <input
                  type="search"
                  value={mobileSearch}
                  onChange={(event) => setMobileSearch(event.target.value)}
                  placeholder="Que necesitas hoy?"
                />
              </label>
              <button type="submit" className="kp-button kp-button-primary">
                Buscar comercios
              </button>
            </form>

            <div className="kp-category-pills" aria-label="Categorias destacadas">
              {categories.map((category) => {
                const Icon = category.icon;
                return (
                  <button key={category.label} type="button" onClick={() => openCategory(category.query)} className="kp-pill">
                    <Icon aria-hidden="true" />
                    {category.label}
                  </button>
                );
              })}
            </div>

            <div className="kp-hero-shortcuts">
              <Link to="/registro-comercio" className="kp-shortcut-card">
                <Store aria-hidden="true" />
                <span>
                  <strong>Soy comercio</strong>
                  <small>Suma tu negocio a KePedimos</small>
                </span>
                <ArrowRight aria-hidden="true" />
              </Link>
              <Link to="/c?delivery=delivery" className="kp-shortcut-card kp-shortcut-card-accent">
                <ShoppingBag aria-hidden="true" />
                <span>
                  <strong>Envio o retiro</strong>
                  <small>Vos elegis como recibirlo</small>
                </span>
                <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="kp-mobile-visual" aria-hidden="true">
            <div className="ke-map-visual" />
          </div>
        </div>

        <div className="kp-shell">
          <div className="kp-value-strip">
            {valueItems.map(([title, description, Icon]) => (
              <article key={title} className="kp-value-item">
                <div className="kp-value-icon">
                  <Icon aria-hidden="true" />
                </div>
                <div>
                  <strong>{title}</strong>
                  <p>{description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="kp-section kp-clarity" id="como-funciona">
        <div className="kp-shell">
          <div className="kp-section-header">
            <div>
              <span className="kp-section-kicker">UNA EXPERIENCIA MAS SERIA</span>
              <h2>Menos artificio visual. Mas claridad para decidir y avanzar.</h2>
              <p>La interfaz prioriza lectura, orden y contraste para encontrar rapido lo que necesitas.</p>
            </div>
            <Link to="/c" className="kp-button kp-button-outline kp-button-accent-outline">
              Explorar comercios
            </Link>
          </div>

          <div className="kp-detail-grid">
            {detailItems.map(([number, label, description, Icon]) => (
              <article key={number} className="kp-detail-card">
                <div className="kp-detail-step">{number}</div>
                <div>
                  <span>{label}</span>
                  <p>{description}</p>
                </div>
                <div className="kp-detail-icon">
                  <Icon aria-hidden="true" />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="kp-section kp-today" id="ayuda">
        <div className="kp-shell">
          <div className="kp-today-card">
            <div className="kp-today-copy">
              <span className="kp-section-kicker kp-section-kicker-accent">PARA HOY</span>
              <h2>Busca cerca, elegi tranquilo y resolve en minutos con</h2>
              <BrandMark imageClassName="kp-inline-brand" />
              <p>
                Ya sea para comer, reponer algo de casa o salir de un apuro, la idea es la misma:
                encontrar opciones reales cerca de ti y avanzar rapido.
              </p>
              <div className="kp-today-pills">
                <span className="kp-pill"><MapPin aria-hidden="true" /> Comercios cercanos</span>
                <span className="kp-pill"><Store aria-hidden="true" /> Envio o retiro</span>
                <span className="kp-pill"><Search aria-hidden="true" /> Busqueda simple</span>
              </div>
            </div>
            <div className="kp-board-scene" aria-hidden="true">
              <div className="kp-board-surface" />
              <div className="kp-board-pin kp-board-pin-a" />
              <div className="kp-board-pin kp-board-pin-b" />
              <div className="kp-board-pin kp-board-pin-main" />
              <div className="kp-board-store-list">
                <article>
                  <div />
                  <span><strong>Burger House</strong><small>4.8 - 15-25 min</small></span>
                </article>
                <article>
                  <div />
                  <span><strong>Farmacia del Centro</strong><small>4.9 - 10-20 min</small></span>
                </article>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="kp-section kp-final-cta">
        <div className="kp-shell">
          <div className="kp-final-card">
            <BrandMark imageClassName="kp-footer-brand" />
            <div>
              <strong>A veces solo queres resolverlo rapido.</strong>
              <p>Menos busqueda, menos friccion y mas claridad para encontrar opciones cerca de ti.</p>
            </div>
            <div className="kp-final-actions">
              <Link to="/c" className="kp-button kp-button-outline">
                <Store aria-hidden="true" /> Explorar comercios
              </Link>
              <Link to="/registro" className="kp-button kp-button-primary">
                Crear cuenta
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="kp-site-footer">
        <div className="kp-shell kp-footer-shell">
          <p>
            <strong>KePedimos</strong> Copyright 2026. Todos los derechos reservados. La disponibilidad de comercios,
            precios, tiempos de entrega y opciones de retiro pueden variar segun la zona y el horario.
          </p>
          <a href="#top" className="kp-button kp-button-outline">
            Volver arriba
            <Package aria-hidden="true" />
          </a>
        </div>
      </footer>
    </div>
  );
}
