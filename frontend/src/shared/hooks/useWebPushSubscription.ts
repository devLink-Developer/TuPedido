import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchWebPushPublicKey, registerPushSubscription, unregisterPushSubscription } from "../services/api";
import type { PushSubscriptionPayload } from "../types";

type WebPushPermission = NotificationPermission | "unsupported";

function isWebPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

function urlBase64ToArrayBuffer(value: string): ArrayBuffer {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(new ArrayBuffer(rawData.length));

  for (let index = 0; index < rawData.length; index += 1) {
    output[index] = rawData.charCodeAt(index);
  }

  return output.buffer;
}

function resolvePlatform(): string {
  const userAgentData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  return userAgentData?.platform || navigator.platform || "web";
}

function toPayload(subscription: PushSubscription): PushSubscriptionPayload {
  const json = subscription.toJSON();

  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
    throw new Error("Invalid browser push subscription");
  }

  return {
    endpoint: json.endpoint,
    keys: {
      p256dh: json.keys.p256dh,
      auth: json.keys.auth
    },
    push_provider: "web",
    platform: resolvePlatform(),
    user_agent: navigator.userAgent
  };
}

function readPermission(): WebPushPermission {
  if (!isWebPushSupported()) {
    return "unsupported";
  }
  return Notification.permission;
}

export function useWebPushSubscription(token: string | null) {
  const [permission, setPermission] = useState<WebPushPermission>(() => readPermission());
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supported = permission !== "unsupported";
  const subscribed = Boolean(subscription);

  const refreshSubscription = useCallback(async () => {
    if (!isWebPushSupported()) {
      setPermission("unsupported");
      setSubscription(null);
      return null;
    }

    setPermission(Notification.permission);
    const registration = await navigator.serviceWorker.ready;
    const currentSubscription = await registration.pushManager.getSubscription();
    setSubscription(currentSubscription);
    return currentSubscription;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkAvailability() {
      if (!token || !isWebPushSupported()) {
        setAvailable(false);
        return;
      }
      try {
        await fetchWebPushPublicKey();
        if (!cancelled) setAvailable(true);
      } catch {
        if (!cancelled) setAvailable(false);
      }
    }

    void checkAvailability();

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    let cancelled = false;

    async function syncExistingSubscription() {
      try {
        const currentSubscription = await refreshSubscription();
        if (!cancelled && token && currentSubscription) {
          await registerPushSubscription(token, toPayload(currentSubscription));
        }
      } catch {
        if (!cancelled) {
          setSubscription(null);
        }
      }
    }

    void syncExistingSubscription();

    return () => {
      cancelled = true;
    };
  }, [refreshSubscription, token]);

  const subscribe = useCallback(async () => {
    if (!token || !isWebPushSupported()) {
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      let nextPermission = Notification.permission;
      if (nextPermission === "default") {
        nextPermission = await Notification.requestPermission();
      }
      setPermission(nextPermission);

      if (nextPermission !== "granted") {
        return null;
      }

      const publicKey = await fetchWebPushPublicKey();
      const registration = await navigator.serviceWorker.ready;
      const nextSubscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToArrayBuffer(publicKey)
        }));

      await registerPushSubscription(token, toPayload(nextSubscription));
      setSubscription(nextSubscription);
      return nextSubscription;
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "No se pudieron activar las notificaciones.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [token]);

  const unsubscribe = useCallback(async () => {
    if (!token || !subscription) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await unregisterPushSubscription(token, subscription.endpoint);
      await subscription.unsubscribe();
      setSubscription(null);
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "No se pudieron desactivar las notificaciones.");
    } finally {
      setLoading(false);
    }
  }, [subscription, token]);

  return useMemo(
    () => ({
      available,
      error,
      loading,
      permission,
      refreshSubscription,
      subscribe,
      subscribed,
      subscription,
      supported,
      unsubscribe
    }),
    [available, error, loading, permission, refreshSubscription, subscribe, subscribed, subscription, supported, unsubscribe]
  );
}
