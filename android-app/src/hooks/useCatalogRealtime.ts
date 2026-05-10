import { useEffect } from "react";
import { AppState } from "react-native";
import { buildCatalogSocketUrl } from "../services/api";

type CatalogRealtimeOptions = {
  enabled?: boolean;
  pollIntervalMs?: number;
  onCatalogChange: () => Promise<void> | void;
  onError?: (message: string | null) => void;
};

const CATALOG_EVENTS = new Set(["catalog.stores.changed", "catalog.stores.created", "catalog.stores.deleted"]);

export function useCatalogRealtime({
  enabled = true,
  pollIntervalMs = 5000,
  onCatalogChange,
  onError
}: CatalogRealtimeOptions) {
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let socket: WebSocket | null = null;
    let pollingTimer: ReturnType<typeof setInterval> | null = null;

    async function refresh() {
      try {
        await onCatalogChange();
        if (!cancelled) onError?.(null);
      } catch {
        if (!cancelled) onError?.("No se pudo actualizar el catálogo en vivo.");
      }
    }

    try {
      socket = new WebSocket(buildCatalogSocketUrl());
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as { type?: string };
          if (payload?.type && CATALOG_EVENTS.has(payload.type)) {
            void refresh();
          }
        } catch {
          onError?.("El catálogo en vivo devolvió un formato inválido.");
        }
      };
      socket.onerror = () => {
        onError?.(null);
      };
    } catch {
      onError?.(null);
    }

    void refresh();
    pollingTimer = setInterval(() => {
      void refresh();
    }, pollIntervalMs);

    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });

    return () => {
      cancelled = true;
      socket?.close();
      if (pollingTimer) clearInterval(pollingTimer);
      appStateSubscription.remove();
    };
  }, [enabled, onCatalogChange, onError, pollIntervalMs]);
}
