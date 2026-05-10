export type LeafletMapCoordinate = number | null | undefined;

export type LeafletMapPointInput = {
  id: string;
  label: string;
  latitude: LeafletMapCoordinate;
  longitude: LeafletMapCoordinate;
  color?: string | null;
};

export type LeafletMapPoint = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  color: string;
};

export type LeafletMapCenterInput = {
  latitude: LeafletMapCoordinate;
  longitude: LeafletMapCoordinate;
};

export type LeafletMapCenter = {
  latitude: number;
  longitude: number;
};

export type LeafletMapHtmlOptions = {
  points: LeafletMapPointInput[];
  center?: LeafletMapCenterInput | null;
  zoom?: number;
  backgroundColor?: string;
  textColor?: string;
  mutedTextColor?: string;
  routeColor?: string;
};

const DEFAULT_MARKER_COLOR = "#EA580C";
const DEFAULT_BACKGROUND_COLOR = "#FDF4F0";
const DEFAULT_TEXT_COLOR = "#0F172A";
const DEFAULT_MUTED_TEXT_COLOR = "#64748B";
const DEFAULT_ROUTE_COLOR = "#2563EB";

function isFiniteCoordinate(value: LeafletMapCoordinate): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isValidLatitude(value: LeafletMapCoordinate): value is number {
  return isFiniteCoordinate(value) && value >= -90 && value <= 90;
}

export function isValidLongitude(value: LeafletMapCoordinate): value is number {
  return isFiniteCoordinate(value) && value >= -180 && value <= 180;
}

export function hasValidLeafletCoordinate(point: Pick<LeafletMapPointInput, "latitude" | "longitude">): boolean {
  return isValidLatitude(point.latitude) && isValidLongitude(point.longitude);
}

export function sanitizeMapColor(value: string | null | undefined, fallback = DEFAULT_MARKER_COLOR): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(trimmed) ? trimmed : fallback;
}

export function normalizeLeafletMapCenter(center: LeafletMapCenterInput | null | undefined): LeafletMapCenter | null {
  if (!center) {
    return null;
  }

  const { latitude, longitude } = center;

  if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
    return null;
  }

  return { latitude, longitude };
}

function normalizeZoom(zoom: number | undefined): number | null {
  return typeof zoom === "number" && Number.isFinite(zoom) && zoom >= 0 && zoom <= 22 ? zoom : null;
}

export function normalizeLeafletMapPoints(points: LeafletMapPointInput[]): LeafletMapPoint[] {
  return points.flatMap((point) => {
    const { latitude, longitude } = point;

    if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
      return [];
    }

    return [
      {
        id: point.id,
        label: point.label,
        latitude,
        longitude,
        color: sanitizeMapColor(point.color)
      }
    ];
  });
}

function jsonForInlineScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003C")
    .replace(/>/g, "\\u003E")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function buildLeafletMapHtml({
  points,
  center,
  zoom,
  backgroundColor,
  textColor,
  mutedTextColor,
  routeColor
}: LeafletMapHtmlOptions): string {
  const validPoints = normalizeLeafletMapPoints(points);
  const mapCenter = normalizeLeafletMapCenter(center);
  const mapZoom = normalizeZoom(zoom);
  const mapBackgroundColor = sanitizeMapColor(backgroundColor, DEFAULT_BACKGROUND_COLOR);
  const mapTextColor = sanitizeMapColor(textColor, DEFAULT_TEXT_COLOR);
  const mapMutedTextColor = sanitizeMapColor(mutedTextColor, DEFAULT_MUTED_TEXT_COLOR);
  const mapRouteColor = sanitizeMapColor(routeColor, DEFAULT_ROUTE_COLOR);

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <link
    rel="stylesheet"
    href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
  />
  <style>
    html,
    body,
    #map {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      background: ${mapBackgroundColor};
      color: ${mapTextColor};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      touch-action: none;
    }

    body {
      overflow: hidden;
      overscroll-behavior: none;
    }

    #map {
      min-height: 160px;
    }

    .empty-state {
      position: absolute;
      inset: 0;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      color: ${mapMutedTextColor};
      font-size: 14px;
      text-align: center;
    }

    .leaflet-container {
      background: ${mapBackgroundColor};
      font-family: inherit;
      touch-action: none;
      -ms-touch-action: none;
      user-select: none;
      -webkit-user-select: none;
    }

    .marker-pin {
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 3px solid #fff;
      border-radius: 999px 999px 999px 4px;
      background: var(--marker-color);
      color: #fff;
      font-size: 12px;
      font-weight: 800;
      box-shadow: 0 8px 18px rgba(15, 23, 42, 0.22);
      transform: rotate(-45deg);
    }

    .marker-pin span {
      transform: rotate(45deg);
    }

    .leaflet-popup-content-wrapper {
      border-radius: 12px;
    }

    .leaflet-popup-content {
      margin: 10px 12px;
      color: ${mapTextColor};
      font-size: 13px;
      line-height: 18px;
    }
  </style>
</head>
<body>
  <div id="map"><div class="empty-state">Cargando mapa...</div></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    (function () {
      var points = ${jsonForInlineScript(validPoints)};
      var preferredCenter = ${jsonForInlineScript(mapCenter)};
      var preferredZoom = ${jsonForInlineScript(mapZoom)};
      var routeColor = ${jsonForInlineScript(mapRouteColor)};
      var mapElement = document.getElementById("map");

      function showEmpty(message) {
        mapElement.innerHTML = "";
        var empty = document.createElement("div");
        empty.className = "empty-state";
        empty.textContent = message;
        mapElement.appendChild(empty);
      }

      if (!window.L) {
        showEmpty("No se pudo cargar el mapa.");
        return;
      }

      if (!points.length) {
        showEmpty("Sin ubicaciones para mostrar.");
        return;
      }

      var map = L.map("map", {
        attributionControl: true,
        scrollWheelZoom: false,
        zoomControl: false,
        zoomSnap: 0.25,
        zoomDelta: 0.5,
        dragging: true,
        touchZoom: "center"
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);
      map.touchZoom.enable();
      map.dragging.enable();
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19
      }).addTo(map);

      var latLngs = points.map(function (point) {
        return [point.latitude, point.longitude];
      });

      points.forEach(function (point, index) {
        var icon = L.divIcon({
          className: "",
          html:
            '<div class="marker-pin" style="--marker-color: ' +
            point.color +
            '"><span>' +
            (index + 1) +
            "</span></div>",
          iconAnchor: [15, 30],
          iconSize: [30, 30],
          popupAnchor: [0, -28]
        });

        var marker = L.marker([point.latitude, point.longitude], {
          icon: icon,
          title: point.label
        }).addTo(map);

        var popup = document.createElement("div");
        var label = document.createElement("strong");
        var coordinates = document.createElement("div");
        label.textContent = point.label;
        coordinates.textContent = point.latitude.toFixed(5) + ", " + point.longitude.toFixed(5);
        popup.appendChild(label);
        popup.appendChild(coordinates);
        marker.bindPopup(popup);
      });

      if (latLngs.length === 1) {
        map.setView(
          preferredCenter ? [preferredCenter.latitude, preferredCenter.longitude] : latLngs[0],
          preferredZoom === null ? 15 : preferredZoom
        );
      } else {
        L.polyline(latLngs, {
          color: routeColor,
          opacity: 0.78,
          weight: 4
        }).addTo(map);
        map.fitBounds(L.latLngBounds(latLngs), {
          maxZoom: 16,
          padding: [28, 28]
        });
      }

      setTimeout(function () {
        map.invalidateSize();
      }, 100);
    })();
  </script>
</body>
</html>`;
}
