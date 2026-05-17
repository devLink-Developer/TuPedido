/// <reference lib="webworker" />

import { clientsClaim } from "workbox-core";
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
  type PrecacheEntry
} from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { NetworkOnly } from "workbox-strategies";

type KepedimosServiceWorker = ServiceWorkerGlobalScope & {
  __WB_MANIFEST?: Array<PrecacheEntry | string>;
};

const sw = self as unknown as KepedimosServiceWorker;

type PushPayload = {
  title?: string;
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  data?: Record<string, unknown>;
};

sw.skipWaiting();
clientsClaim();

precacheAndRoute((self as unknown as { __WB_MANIFEST: Array<PrecacheEntry | string> }).__WB_MANIFEST);
cleanupOutdatedCaches();

registerRoute(({ url }) => url.pathname.startsWith("/api/v1/"), new NetworkOnly());

registerRoute(
  new NavigationRoute(createHandlerBoundToURL("/index.html"), {
    denylist: [/^\/api\//]
  })
);

function parsePushPayload(event: PushEvent): PushPayload {
  if (!event.data) {
    return {};
  }

  try {
    return event.data.json() as PushPayload;
  } catch {
    return {
      body: event.data.text()
    };
  }
}

function resolveNotificationUrl(payload: PushPayload): string {
  const rawUrl = payload.url ?? (typeof payload.data?.url === "string" ? payload.data.url : "/");

  try {
    const url = new URL(rawUrl, sw.location.origin);
    return url.origin === sw.location.origin ? `${url.pathname}${url.search}${url.hash}` : "/";
  } catch {
    return "/";
  }
}

sw.addEventListener("push", (event) => {
  const payload = parsePushPayload(event);
  const title = payload.title ?? "Kepedimos";

  event.waitUntil(
    sw.registration.showNotification(title, {
      body: payload.body,
      icon: payload.icon ?? "/icons/app-icon-192.png",
      badge: payload.badge ?? "/icons/app-icon-192.png",
      tag: payload.tag,
      data: {
        ...(payload.data ?? {}),
        url: resolveNotificationUrl(payload)
      }
    })
  );
});

sw.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = typeof event.notification.data?.url === "string" ? event.notification.data.url : "/";
  const target = new URL(targetUrl, sw.location.origin).toString();

  event.waitUntil(
    sw.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          const windowClient = client as WindowClient;
          if ("navigate" in windowClient) {
            await windowClient.navigate(target);
          }
          return windowClient.focus();
        }
      }

      return sw.clients.openWindow(target);
    })
  );
});
