import { useEffect, useRef, useState } from "react";
import type { Order } from "../types/api";
import {
  getTrackedOrderId,
  pushCurrentDeliveryLocation,
  requestDeliveryLocationPermissions,
  startDeliveryLocationTracking,
  stopDeliveryLocationTracking
} from "../tracking/backgroundLocation";
import { shouldAutoShareDeliveryLocation } from "../utils/deliveryRoute";

type TrackingStatus = "idle" | "starting" | "active" | "blocked" | "error";

export function useAutoDeliveryLocationTracking({
  token,
  order,
  enabled = true,
  onPermissionBlocked,
  onError
}: {
  token: string | null;
  order: Order | null;
  enabled?: boolean;
  onPermissionBlocked?: (message?: string) => void;
  onError?: (message: string) => void;
}) {
  const [status, setStatus] = useState<TrackingStatus>("idle");
  const [trackedOrderId, setTrackedOrderId] = useState<number | null>(null);
  const notifiedBlockedOrderRef = useRef<number | null>(null);
  const notifiedErrorOrderRef = useRef<number | null>(null);
  const pushedCurrentOrderRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function syncTracking() {
      const shouldTrack = Boolean(token && enabled && shouldAutoShareDeliveryLocation(order));
      if (!shouldTrack || !order || !token) {
        const currentTrackedOrderId = await getTrackedOrderId();
        if (!cancelled && currentTrackedOrderId && (!order || currentTrackedOrderId === order.id)) {
          await stopDeliveryLocationTracking().catch(() => undefined);
          setTrackedOrderId(null);
        }
        if (!cancelled) setStatus("idle");
        return;
      }

      try {
        const currentTrackedOrderId = await getTrackedOrderId();
        if (cancelled) return;

        if (currentTrackedOrderId !== order.id) {
          setStatus("starting");
          const permission = await requestDeliveryLocationPermissions();
          if (cancelled) return;
          if (!permission.granted) {
            setTrackedOrderId(null);
            setStatus("blocked");
            if (notifiedBlockedOrderRef.current !== order.id) {
              notifiedBlockedOrderRef.current = order.id;
              onPermissionBlocked?.(permission.message);
            }
            return;
          }
          await startDeliveryLocationTracking(order.id);
        }

        if (pushedCurrentOrderRef.current !== order.id) {
          pushedCurrentOrderRef.current = order.id;
          await pushCurrentDeliveryLocation(token, order.id).catch(() => undefined);
        }

        if (!cancelled) {
          setTrackedOrderId(order.id);
          setStatus("active");
        }
      } catch {
        if (cancelled) return;
        setStatus("error");
        if (order && notifiedErrorOrderRef.current !== order.id) {
          notifiedErrorOrderRef.current = order.id;
          onError?.("No se pudo activar el seguimiento automatico.");
        }
      }
    }

    void syncTracking();

    return () => {
      cancelled = true;
    };
  }, [enabled, onError, onPermissionBlocked, order, token]);

  return { status, trackedOrderId };
}
