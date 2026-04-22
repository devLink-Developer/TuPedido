import type { PropsWithChildren } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { BrandMark } from "../../shared/components";
import { useAuthSession } from "../../shared/hooks";
import { usePlatformBranding } from "../../shared/providers/PlatformBrandingProvider";

const navItems = [
  { to: "/r", label: "Panel" },
  { to: "/r/pedidos", label: "Pedidos" },
  { to: "/r/historial", label: "Historial" },
  { to: "/r/ganancias", label: "Ganancias" }
];

export function RiderLayout({ children }: PropsWithChildren) {
  const navigate = useNavigate();
  const { user, logout } = useAuthSession();
  const { brandName, branding } = usePlatformBranding();

  return (
    <div className="app-shell min-h-screen text-ink">
      <header>
        <div className="app-panel-dark w-full border border-x-0 border-white/10">
          <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 py-4 md:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-5">
                <Link to="/r" aria-label={`Ir al panel rider de ${brandName}`} className="inline-flex items-center">
                  <BrandMark
                    brandName={brandName}
                    logoUrl={branding?.platform_logo_url ?? null}
                    imageClassName="h-10 max-w-[10rem] sm:h-11 sm:max-w-[11.5rem]"
                    textClassName="text-[1.6rem] text-white"
                  />
                </Link>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#ffd0ba]/70">Rider</p>
                  <h1 className="mt-2 font-display text-[1.85rem] font-bold leading-[1.04] tracking-tight sm:text-3xl">
                    Operacion en ruta
                  </h1>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-white/68">
                    Navegacion rapida para tomar pedidos, cerrar entregas y revisar ganancias sin cambiar de contexto.
                  </p>
                </div>
              </div>
              <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/r"}
                    className={({ isActive }) =>
                      [
                        "border border-transparent px-3.5 py-1.5 text-center text-[13px] font-semibold transition",
                        isActive ? "app-sidebar-link-active" : "app-sidebar-link"
                      ].join(" ")
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
                <div className="ml-0 w-full border border-white/10 bg-white/8 px-3.5 py-1.5 text-[13px] text-white/80 sm:w-auto xl:ml-2">
                  <p className="font-semibold text-white">{user?.full_name ?? "Rider"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    navigate("/login", { replace: true });
                  }}
                  className="w-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-[13px] font-semibold text-white transition hover:bg-white hover:text-ink sm:w-auto"
                >
                  Cerrar sesion
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1200px] px-4 py-5 md:px-6 md:py-6">{children}</main>
    </div>
  );
}
