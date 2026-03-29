import { useEffect } from "react";
import { buildOrderSocketUrl, REALTIME_ENABLED } from "../services/api";
import type { Order, OrderTracking } from "../types";

export function useOrderLiveTracking({
  token,
  orderId,
  enabled = true,
  onOrder,
  onTracking,
  onError
}: {
  token: string | null;
  orderId: number | null;
  enabled?: boolean;
  onOrder: (order: Order) => void;
  onTracking: (tracking: OrderTracking) => void;
  onError?: (message: string | null) => void;
}) {
  useEffect(() => {
    if (!token || !orderId || !enabled || !REALTIME_ENABLED) return;
    let socket: WebSocket | null = null;
    try {
      socket = new WebSocket(buildOrderSocketUrl(token, orderId));
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.order) onOrder(payload.order as Order);
          if (payload?.tracking) onTracking(payload.tracking as OrderTracking);
          onError?.(null);
        } catch {
          onError?.("La conexión en tiempo real devolvió un formato inválido");
        }
      };
      socket.onerror = () => {
        onError?.("No se pudo abrir el seguimiento en tiempo real");
      };
    } catch {
      onError?.("Tu navegador no pudo abrir el seguimiento en tiempo real");
    }

    return () => {
      socket?.close();
    };
  }, [enabled, onError, onOrder, onTracking, orderId, token]);
}
