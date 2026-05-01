import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSession } from "../session";
import type { Role } from "../types";

export const roleHome: Record<Role, string> = {
  customer: "/",
  merchant: "/merchant",
  admin: "/admin",
  delivery: "/delivery"
};

export const dayNames = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

export const paymentMethodLabels: Record<string, string> = {
  cash: "Efectivo",
  mercadopago: "Mercado Pago"
};

export const statusLabels: Record<string, string> = {
  created: "Creado",
  accepted: "Aceptado",
  preparing: "Preparando",
  ready_for_dispatch: "Listo para despacho",
  ready_for_pickup: "Listo para retirar",
  assignment_pending: "Buscando rider",
  assigned: "Rider asignado",
  heading_to_store: "Yendo al comercio",
  picked_up: "Retirado",
  near_customer: "Cerca del cliente",
  out_for_delivery: "En camino",
  delivered: "Entregado",
  delivery_failed: "Entrega fallida",
  cancelled: "Cancelado",
  pending: "Pendiente",
  pending_review: "Pendiente de revision",
  approved: "Aprobado",
  rejected: "Rechazado",
  suspended: "Suspendido"
};

export const orderStatusOptions = [
  "created",
  "accepted",
  "preparing",
  "ready_for_dispatch",
  "ready_for_pickup",
  "out_for_delivery",
  "delivered",
  "cancelled"
] as const;

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2
  }).format(value);
}

export function formatHour(value: string | null) {
  return value ? value.slice(0, 5) : "";
}

export function timeFromInput(value: string) {
  return value.length === 5 ? `${value}:00` : value;
}

function currentOrigin() {
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin;
  }
  return "http://localhost";
}

export function normalizePath(url: string) {
  try {
    const parsed = new URL(url, currentOrigin());
    if (parsed.origin !== currentOrigin()) {
      return url;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
}

export function LoadingCard({ label = "Cargando..." }: { label?: string }) {
  return (
    <div className="mesh-surface rounded border border-white/80 p-6 shadow-lift">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Estado</p>
      <p className="mt-3 font-display text-2xl font-bold tracking-tight text-ink">{label}</p>
    </div>
  );
}

export function EmptyCard({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="mesh-surface rounded border border-dashed border-[#dbcabc] p-8 text-center shadow-lift">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-400">Sin resultados</p>
      <h3 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-zinc-600">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action
}: {
  eyebrow: string;
  title: ReactNode;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="ambient-grid overflow-hidden rounded bg-[linear-gradient(135deg,#1d1614_0%,#281b18_45%,#3a221a_100%)] p-6 text-white shadow-lift">
      <div className="absolute right-4 top-4 h-24 w-24 rounded bg-brand-400/20 blur-3xl" />
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#ffd3bf]">{eyebrow}</p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight md:text-[2.35rem]">{title}</h1>
          {description ? <p className="mt-3 max-w-2xl text-sm leading-7 text-white/74">{description}</p> : null}
        </div>
        {action ? <div className="relative">{action}</div> : null}
      </div>
    </div>
  );
}

export function Guard({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, loading, isAuthenticated } = useSession();
  const location = useLocation();
  if (loading) return <LoadingCard label="Validando sesion..." />;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  if (roles && user && !roles.includes(user.role)) return <Navigate to={roleHome[user.role]} replace />;
  return <>{children}</>;
}

export function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading, isAuthenticated } = useSession();
  if (loading) return <LoadingCard label="Cargando acceso..." />;
  if (isAuthenticated && user) return <Navigate to={roleHome[user.role]} replace />;
  return <>{children}</>;
}
