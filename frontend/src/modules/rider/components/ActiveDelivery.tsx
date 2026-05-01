import { useState } from "react";
import { Button } from "../../../shared/ui/Button";
import type { Order } from "../../../shared/types";
import { formatCurrency } from "../../../shared/utils/format";
import { statusLabels } from "../../../shared/utils/labels";
import { LiveMap } from "../../../shared/components";

export function ActiveDelivery({
  order,
  onPickup,
  onDeliver,
  loading
}: {
  order: Order;
  onPickup: () => Promise<void>;
  onDeliver: (otp: string) => Promise<void>;
  loading: boolean;
}) {
  const [otpCode, setOtpCode] = useState("");
  const points = [
    order.store_latitude !== null && order.store_longitude !== null
      ? {
          id: "store",
          latitude: order.store_latitude,
          longitude: order.store_longitude,
          color: "linear-gradient(135deg,#f97316,#c2410c)",
          label: "Tienda"
        }
      : null,
    order.address_latitude !== null && order.address_longitude !== null
      ? {
          id: "customer",
          latitude: order.address_latitude,
          longitude: order.address_longitude,
          color: "linear-gradient(135deg,#1f2937,#111827)",
          label: "Destino"
        }
      : null,
    order.tracking_last_latitude !== null && order.tracking_last_longitude !== null
      ? {
          id: "rider",
          latitude: order.tracking_last_latitude,
          longitude: order.tracking_last_longitude,
          color: "linear-gradient(135deg,#10b981,#047857)",
          label: "Rider"
        }
      : null
  ].filter(Boolean) as Array<{ id: string; latitude: number; longitude: number; color: string; label: string }>;

  return (
    <article className="mesh-surface space-y-4 rounded border border-white/80 p-5 shadow-lift">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Pedido #{order.id}</p>
          <h3 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink">{order.store_name}</h3>
          <p className="mt-2 text-sm text-zinc-600">{order.address_full ?? order.address_label ?? "Retiro en local"}</p>
        </div>
        <div className="rounded bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
          {statusLabels[order.delivery_status] ?? order.delivery_status}
        </div>
      </div>

      {points.length ? <LiveMap points={points} className="h-56" /> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded bg-[#fff6ef] px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Total cliente</p>
          <p className="mt-2 text-lg font-bold text-ink">{formatCurrency(order.pricing.total)}</p>
        </div>
        <div className="rounded bg-[#f6fbf7] px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Ganancia rider</p>
          <p className="mt-2 text-lg font-bold text-ink">{formatCurrency(order.rider_fee)}</p>
        </div>
        <div className="rounded bg-[#f5f7fb] px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">ETA</p>
          <p className="mt-2 text-lg font-bold text-ink">{order.eta_minutes ? `${order.eta_minutes} min` : "Sin ETA"}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {order.delivery_status === "assigned" || order.delivery_status === "heading_to_store" ? (
          <Button type="button" disabled={loading} onClick={() => void onPickup()}>Confirmar retiro</Button>
        ) : null}
        {order.delivery_status === "picked_up" || order.delivery_status === "near_customer" ? (
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <input value={otpCode} onChange={(event) => setOtpCode(event.target.value)} placeholder="OTP cliente" className="min-w-[160px] flex-1 rounded border border-black/10 bg-white px-4 py-3 text-sm" />
            <Button type="button" disabled={loading} onClick={() => void onDeliver(otpCode)}>{loading ? "Cerrando..." : "Entregar"}</Button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
