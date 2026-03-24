import { useEffect } from "react";
import { buildOrderSocketUrl, fetchOrder, fetchOrderTracking } from "../api";
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
    if (!token || !orderId || !enabled) return;
    const authToken = token;
    const currentOrderId = orderId;
    let socket: WebSocket | null = null;
    let cancelled = false;

    async function hydrate() {
      try {
        const [order, tracking] = await Promise.all([
          fetchOrder(authToken, currentOrderId),
          fetchOrderTracking(authToken, currentOrderId)
        ]);
        if (cancelled) return;
        onOrder(order);
        onTracking(tracking);
      } catch (error) {
        if (!cancelled) onError?.(error instanceof Error ? error.message : "No se pudo sincronizar el pedido");
      }
    }

    void hydrate();
    try {
      socket = new WebSocket(buildOrderSocketUrl(authToken, currentOrderId));
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.order) onOrder(payload.order as Order);
          if (payload?.tracking) onTracking(payload.tracking as OrderTracking);
          onError?.(null);
        } catch {
          onError?.("La conexion en tiempo real devolvio un formato invalido");
        }
      };
      socket.onerror = () => {
        onError?.("No se pudo abrir el seguimiento en tiempo real");
      };
    } catch {
      onError?.("Tu navegador no pudo abrir el seguimiento en tiempo real");
    }

    return () => {
      cancelled = true;
      socket?.close();
    };
  }, [enabled, onError, onOrder, onTracking, orderId, token]);
}
