import type { PropsWithChildren } from "react";
import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/a", label: "Dashboard" },
  { to: "/a/usuarios", label: "Usuarios" },
  { to: "/a/comercios", label: "Comercios" },
  { to: "/a/riders", label: "Riders" },
  { to: "/a/pedidos", label: "Pedidos" },
  { to: "/a/configuracion", label: "Configuración" }
];

export function AdminLayout({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f2f4f8_0%,#fbfcff_100%)] text-ink">
      <div className="mx-auto flex min-h-screen max-w-[1640px] flex-col lg:flex-row">
        <aside className="w-full border-b border-black/5 bg-[#111827] px-6 py-6 text-white lg:w-[320px] lg:border-b-0 lg:border-r lg:border-white/10">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-200/70">Admin</p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">Control central</h1>
          <div className="mt-6 grid gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/a"}
                className={({ isActive }) =>
                  [
                    "rounded-[22px] px-4 py-3 text-sm font-semibold transition",
                    isActive ? "bg-white text-ink shadow-float" : "border border-white/10 bg-white/5 text-white/80"
                  ].join(" ")
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </aside>
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
