import { useEffect } from "react";
import { buildOrderSocketUrl, fetchOrderTracking } from "../services/api";
import type { Order, OrderTracking } from "../types/api";

export function useOrderRealtime({
  token,
  orderId,
  enabled = true,
  onOrder,
  onTracking,
  onError,
  pollOrder
}: {
  token: string | null;
  orderId: number | null;
  enabled?: boolean;
  onOrder?: (order: Order) => void;
  onTracking?: (tracking: OrderTracking) => void;
  onError?: (message: string | null) => void;
  pollOrder?: () => Promise<Order | null>;
}) {
  useEffect(() => {
    if (!token || !orderId || !enabled) return;

    let socket: WebSocket | null = null;
    let pollingTimer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    async function poll() {
      if (!token || !orderId || cancelled) return;
      try {
        const [tracking, nextOrder] = await Promise.all([
          fetchOrderTracking(token, orderId).catch(() => null),
          pollOrder ? pollOrder().catch(() => null) : Promise.resolve(null)
        ]);
        if (cancelled) return;
        if (tracking) onTracking?.(tracking);
        if (nextOrder) onOrder?.(nextOrder);
        onError?.(null);
      } catch {
        if (!cancelled) onError?.("No se pudo actualizar el seguimiento");
      }
    }

    try {
      socket = new WebSocket(buildOrderSocketUrl(token, orderId));
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.order) onOrder?.(payload.order as Order);
          if (payload?.tracking) onTracking?.(payload.tracking as OrderTracking);
          onError?.(null);
        } catch {
          onError?.("El seguimiento en vivo devolvió un formato inválido");
        }
      };
      socket.onerror = () => {
        onError?.(null);
        void poll();
      };
    } catch {
      onError?.(null);
      void poll();
    }

    void poll();
    pollingTimer = setInterval(() => {
      void poll();
    }, 10000);

    return () => {
      cancelled = true;
      socket?.close();
      if (pollingTimer) clearInterval(pollingTimer);
    };
  }, [enabled, onError, onOrder, onTracking, orderId, pollOrder, token]);
}
