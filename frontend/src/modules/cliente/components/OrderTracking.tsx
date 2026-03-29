import type { Order, OrderTracking as OrderTrackingType } from "../../../shared/types";
import { statusLabels } from "../../../shared/utils/labels";
import { LiveMap } from "../../../shared/components";

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
          label: "Tienda"
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
          label: "Rider"
        }
      : null
  ].filter(Boolean) as Array<{ id: string; latitude: number; longitude: number; color: string; label: string }>;

  return (
    <div className="rounded-[28px] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">Seguimiento del pedido</h3>
          <p className="mt-1 text-sm text-zinc-500">
            {tracking.assigned_rider_name
              ? `${tracking.assigned_rider_name} · ${tracking.assigned_rider_vehicle_type ?? "rider"}`
              : "Esperando asignación"}
          </p>
        </div>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
          {statusLabels[tracking.delivery_status] ?? tracking.delivery_status}
        </span>
      </div>

      {mapPoints.length ? <LiveMap points={mapPoints} className="mt-4 h-60" /> : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
          <p className="font-semibold text-ink">Entrega</p>
          <p className="mt-1">{order.address_full ?? order.address_label ?? "Retiro en local"}</p>
        </div>
        <div className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
          <p className="font-semibold text-ink">Seguridad</p>
          <p className="mt-1">{tracking.otp_required ? "OTP activo" : "Sin OTP requerido"}</p>
          {tracking.otp_code ? <p className="mt-1 font-semibold text-brand-700">Código: {tracking.otp_code}</p> : null}
        </div>
      </div>
    </div>
  );
}
