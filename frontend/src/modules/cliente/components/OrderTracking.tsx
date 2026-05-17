import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Clock3,
  KeyRound,
  MapPinned,
  Navigation,
  PackageCheck,
  ShieldCheck,
  Store,
  Truck,
  UserRound,
  type LucideIcon
} from "lucide-react";
import type { Order, OrderTracking as OrderTrackingType } from "../../../shared/types";
import { formatDateTime } from "../../../shared/utils/format";
import { statusLabels } from "../../../shared/utils/labels";
import { LiveMap } from "../../../shared/components";

type TrackingStep = {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

const DELIVERY_STEPS: TrackingStep[] = [
  { key: "created", title: "Pedido creado", description: "Recibimos tu pedido.", icon: CheckCircle2 },
  { key: "accepted", title: "Comercio confirma", description: "El comercio revisa disponibilidad.", icon: Store },
  { key: "preparing", title: "Preparacion", description: "Tu pedido se esta armando.", icon: Clock3 },
  { key: "ready_for_dispatch", title: "Listo para envio", description: "Queda listo para entregar.", icon: PackageCheck },
  { key: "out_for_delivery", title: "En camino", description: "El repartidor avanza al destino.", icon: Truck },
  { key: "delivered", title: "Entregado", description: "Pedido finalizado.", icon: CheckCircle2 }
];

const PICKUP_STEPS: TrackingStep[] = [
  { key: "created", title: "Pedido creado", description: "Recibimos tu pedido.", icon: CheckCircle2 },
  { key: "accepted", title: "Comercio confirma", description: "El comercio revisa disponibilidad.", icon: Store },
  { key: "preparing", title: "Preparacion", description: "Tu pedido se esta armando.", icon: Clock3 },
  { key: "ready_for_pickup", title: "Listo para retirar", description: "Puedes pasar por el local.", icon: PackageCheck },
  { key: "delivered", title: "Retirado", description: "Pedido finalizado.", icon: CheckCircle2 }
];

function getSteps(order: Order) {
  return order.delivery_mode === "pickup" ? PICKUP_STEPS : DELIVERY_STEPS;
}

function getCurrentStepIndex(order: Order, steps: TrackingStep[]) {
  const directIndex = steps.findIndex((step) => step.key === order.status);
  if (directIndex >= 0) return directIndex;
  if (order.status === "ready_for_dispatch" && order.delivery_status === "picked_up") {
    return steps.findIndex((step) => step.key === "out_for_delivery");
  }
  return 0;
}

function getTrackingSummary(order: Order, tracking: OrderTrackingType) {
  if (order.delivery_mode === "pickup") {
    return order.status === "ready_for_pickup"
      ? "Tu pedido esta listo para retirar."
      : "Te avisaremos cuando el comercio lo marque como listo.";
  }

  if (tracking.tracking_stale) {
    return "La ubicacion puede estar demorada, pero seguimos actualizando el estado.";
  }

  if (tracking.assigned_rider_name) {
    return tracking.eta_minutes !== null
      ? `${tracking.assigned_rider_name} va con tu pedido. ETA ${tracking.eta_minutes} min.`
      : `${tracking.assigned_rider_name} esta asignado al pedido.`;
  }

  return "El comercio todavia no asigno repartidor para este pedido.";
}

export function OrderTracking({
  order,
  tracking
}: {
  order: Order;
  tracking: OrderTrackingType;
}) {
  const mapPoints = [
    tracking.store_latitude !== null && tracking.store_longitude !== null
      ? {
          id: "store",
          latitude: tracking.store_latitude,
          longitude: tracking.store_longitude,
          color: "linear-gradient(135deg,#f97316,#c2410c)",
          label: "Comercio"
        }
      : null,
    tracking.address_latitude !== null && tracking.address_longitude !== null
      ? {
          id: "customer",
          latitude: tracking.address_latitude,
          longitude: tracking.address_longitude,
          color: "linear-gradient(135deg,#1f2937,#111827)",
          label: "Destino"
        }
      : null,
    tracking.tracking_last_latitude !== null && tracking.tracking_last_longitude !== null
      ? {
          id: "rider",
          latitude: tracking.tracking_last_latitude,
          longitude: tracking.tracking_last_longitude,
          color: "linear-gradient(135deg,#10b981,#047857)",
          label: "Repartidor"
        }
      : null
  ].filter(Boolean) as Array<{ id: string; latitude: number; longitude: number; color: string; label: string }>;

  const steps = getSteps(order);
  const currentStepIndex = getCurrentStepIndex(order, steps);
  const deliveryStatusLabel = statusLabels[tracking.delivery_status] ?? tracking.delivery_status;
  const statusLabel = statusLabels[tracking.status] ?? tracking.status;
  const etaLabel = tracking.eta_minutes !== null ? `${tracking.eta_minutes} min` : "A confirmar";
  const lastLocationLabel = tracking.tracking_last_at ? formatDateTime(tracking.tracking_last_at) : "Sin ubicacion reciente";
  const destinationLabel = order.address_full ?? order.address_label ?? "Retiro en local";
  const hasOtp = tracking.otp_required || Boolean(tracking.otp_code);

  return (
    <section className="app-panel p-0">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
        <div className="p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-600">Seguimiento en vivo</p>
              <h3 className="mt-2 text-xl font-black tracking-tight text-ink">Pedido #{order.id}</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">{getTrackingSummary(order, tracking)}</p>
            </div>
            <span className="inline-flex min-h-[34px] items-center rounded-full bg-brand-100 px-3 py-1 text-xs font-bold text-brand-700">
              {deliveryStatusLabel}
            </span>
          </div>

          {hasOtp ? (
            <div className="mt-4 rounded-[18px] border border-brand-200 bg-brand-50 px-4 py-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-black text-ink">
                    <KeyRound className="h-4 w-4 text-brand-700" aria-hidden="true" />
                    Código de entrega
                  </div>
                  <p className="mt-1 text-sm leading-6 text-zinc-600">
                    Mostráselo al repartidor al recibir el pedido.
                  </p>
                </div>
                {tracking.otp_code ? (
                  <p className="select-all rounded-[14px] border border-brand-200 bg-white px-5 py-3 text-center text-3xl font-black tracking-[0.22em] text-brand-700">
                    {tracking.otp_code}
                  </p>
                ) : (
                  <p className="rounded-[14px] border border-amber-200 bg-white px-4 py-3 text-sm font-bold text-amber-800">
                    Aparecerá cuando el seguimiento esté activo.
                  </p>
                )}
              </div>
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[18px] border border-[var(--color-border-default)] bg-white/88 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Estado</p>
              <p className="mt-2 text-sm font-bold text-ink">{statusLabel}</p>
            </div>
            <div className="rounded-[18px] border border-[var(--color-border-default)] bg-white/88 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">ETA</p>
              <p className="mt-2 text-sm font-bold text-ink">{etaLabel}</p>
            </div>
            <div className="rounded-[18px] border border-[var(--color-border-default)] bg-white/88 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Actualizado</p>
              <p className="mt-2 text-sm font-bold text-ink">{lastLocationLabel}</p>
            </div>
          </div>

          {mapPoints.length ? (
            <div className="mt-4">
              <LiveMap points={mapPoints} className="h-[20rem] border border-[var(--color-border-default)] sm:h-[24rem]" />
              <div className="mt-3 flex flex-wrap gap-2">
                {mapPoints.map((point) => (
                  <span key={point.id} className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold text-zinc-600 shadow-sm">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: point.color }} />
                    {point.label}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-4 flex min-h-[18rem] flex-col items-center justify-center rounded-[22px] border border-dashed border-[var(--color-border-default)] bg-white/72 p-6 text-center">
              <MapPinned className="h-8 w-8 text-brand-600" aria-hidden="true" />
              <p className="mt-3 font-bold text-ink">Mapa pendiente</p>
              <p className="mt-1 max-w-sm text-sm text-zinc-600">Aparecera cuando el comercio comparta puntos de seguimiento para este pedido.</p>
            </div>
          )}
        </div>

        <aside className="border-t border-[var(--color-border-default)] bg-[linear-gradient(180deg,#fffaf5_0%,#ffffff_100%)] p-4 sm:p-5 lg:border-l lg:border-t-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-400">Progreso</p>
              <h4 className="mt-2 text-lg font-black text-ink">Etapas del pedido</h4>
            </div>
            {tracking.tracking_stale ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                Demorado
              </span>
            ) : null}
          </div>

          <ol className="mt-4 space-y-3" aria-label="Progreso del pedido">
            {steps.map((step, index) => {
              const done = index < currentStepIndex || order.status === "delivered";
              const current = index === currentStepIndex && order.status !== "delivered";
              const StepIcon = done ? CheckCircle2 : current ? step.icon : Circle;
              return (
                <li
                  key={step.key}
                  className={`grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-[18px] border px-3 py-3 transition ${
                    current
                      ? "border-brand-200 bg-white shadow-sm"
                      : done
                        ? "border-emerald-100 bg-white/86"
                        : "border-[var(--color-border-default)] bg-white/62"
                  }`}
                >
                  <span
                    className={`mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full ${
                      done ? "bg-emerald-100 text-emerald-700" : current ? "bg-brand-100 text-brand-700" : "bg-zinc-100 text-zinc-400"
                    }`}
                  >
                    <StepIcon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-ink">{step.title}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-zinc-500">{step.description}</span>
                  </span>
                </li>
              );
            })}
          </ol>

          <div className="mt-4 grid gap-3">
            <div className="rounded-[18px] border border-[var(--color-border-default)] bg-white px-4 py-3 text-sm text-zinc-600">
              <div className="flex items-center gap-2 font-bold text-ink">
                <UserRound className="h-4 w-4 text-brand-600" aria-hidden="true" />
                Repartidor
              </div>
              <p className="mt-2">
                {tracking.assigned_rider_name
                  ? `${tracking.assigned_rider_name} - ${tracking.assigned_rider_vehicle_type ?? "movilidad no informada"}`
                  : "Aun sin repartidor asignado por el comercio."}
              </p>
              {tracking.assigned_rider_phone_masked ? <p className="mt-1 font-semibold">Tel. {tracking.assigned_rider_phone_masked}</p> : null}
            </div>

            <div className="rounded-[18px] border border-[var(--color-border-default)] bg-white px-4 py-3 text-sm text-zinc-600">
              <div className="flex items-center gap-2 font-bold text-ink">
                <Navigation className="h-4 w-4 text-brand-600" aria-hidden="true" />
                {order.delivery_mode === "pickup" ? "Retiro" : "Destino"}
              </div>
              <p className="mt-2">{destinationLabel}</p>
            </div>

            <div className="rounded-[18px] border border-[var(--color-border-default)] bg-white px-4 py-3 text-sm text-zinc-600">
              <div className="flex items-center gap-2 font-bold text-ink">
                {hasOtp ? <KeyRound className="h-4 w-4 text-brand-600" aria-hidden="true" /> : <ShieldCheck className="h-4 w-4 text-brand-600" aria-hidden="true" />}
                Seguridad
              </div>
              <p className="mt-2">{tracking.otp_required ? "Entrega con codigo de confirmacion." : "Sin codigo requerido para este pedido."}</p>
              {tracking.otp_code ? <p className="mt-2 text-base font-black text-brand-700">Codigo: {tracking.otp_code}</p> : null}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
