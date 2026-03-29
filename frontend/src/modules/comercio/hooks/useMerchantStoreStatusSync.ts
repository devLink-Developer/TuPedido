import { useEffect, type Dispatch, type SetStateAction } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthSession } from "../../../shared/hooks";
import { fetchMerchantStore } from "../../../shared/services/api";
import type { MerchantStore } from "../../../shared/types";
import { roleToHomePath } from "../../../shared/utils/routing";

const MERCHANT_STORE_STATUS_REFRESH_INTERVAL_MS = 15000;

type MerchantStoreStatusSyncOptions = {
  paused?: boolean;
  store: MerchantStore | null;
  setStore: Dispatch<SetStateAction<MerchantStore | null>>;
};

export function useMerchantStoreStatusSync({
  paused = false,
  store,
  setStore
}: MerchantStoreStatusSyncOptions) {
  const navigate = useNavigate();
  const { token, refresh } = useAuthSession();

  useEffect(() => {
    if (!token || !store || paused) {
      return;
    }

    const sessionToken = token;
    let cancelled = false;
    let syncing = false;

    async function syncStoreStatus() {
      if (syncing) {
        return;
      }

      syncing = true;
      try {
        const latestStore = await fetchMerchantStore(sessionToken);
        if (!cancelled) {
          setStore((current) =>
            current
              ? {
                  ...current,
                  status: latestStore.status,
                  accepting_orders: latestStore.accepting_orders,
                  is_open: latestStore.is_open
                }
              : current
          );
        }
      } catch {
        if (!cancelled) {
          try {
            const refreshedUser = await refresh();
            if (!cancelled && refreshedUser && refreshedUser.role !== "merchant") {
              navigate(roleToHomePath[refreshedUser.role], { replace: true });
            }
          } catch {
            // Keep the current screen stable on transient failures.
          }
        }
      } finally {
        syncing = false;
      }
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void syncStoreStatus();
      }
    }, MERCHANT_STORE_STATUS_REFRESH_INTERVAL_MS);

    const handleFocus = () => {
      void syncStoreStatus();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncStoreStatus();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [navigate, paused, refresh, setStore, store, token]);
}
