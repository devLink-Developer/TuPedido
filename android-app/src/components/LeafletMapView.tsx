import { useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { colors, radii, spacing } from "../theme";
import {
  hasValidLeafletCoordinate,
  normalizeLeafletMapPoints,
  type LeafletMapCenterInput,
  type LeafletMapPointInput
} from "../utils/leafletMap";

export type LeafletMapMarker = LeafletMapPointInput & {
  draggable?: boolean;
};

type Coordinate = {
  latitude: number;
  longitude: number;
};

type LeafletMapViewProps = {
  points?: LeafletMapPointInput[];
  markers?: LeafletMapMarker[];
  path?: LeafletMapCenterInput[] | null;
  center?: LeafletMapCenterInput | null;
  focusCenter?: LeafletMapCenterInput | null;
  focusZoom?: number;
  zoom?: number;
  accessibilityLabel?: string;
  emptyMessage?: string;
  height?: number;
  interactive?: boolean;
  onCoordinateChange?: (coordinate: Coordinate, markerId?: string) => void;
  style?: StyleProp<ViewStyle>;
};

function jsonForInlineScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003C")
    .replace(/>/g, "\\u003E")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function buildInteractiveLeafletHtml({
  points,
  path,
  center,
  focusCenter,
  focusZoom,
  zoom,
  interactive
}: {
  points: LeafletMapMarker[];
  path?: LeafletMapCenterInput[] | null;
  center?: LeafletMapCenterInput | null;
  focusCenter?: LeafletMapCenterInput | null;
  focusZoom?: number;
  zoom?: number;
  interactive: boolean;
}) {
  const validPoints = points
    .filter(hasValidLeafletCoordinate)
    .map((point) => ({
      id: point.id,
      label: point.label,
      latitude: Number(point.latitude),
      longitude: Number(point.longitude),
      color: point.color ?? colors.primary,
      draggable: Boolean(point.draggable)
    }));
  const routePath = (path ?? [])
    .filter(hasValidLeafletCoordinate)
    .map((point) => ({
      latitude: Number(point.latitude),
      longitude: Number(point.longitude)
    }));
  const preferredCenter = center && hasValidLeafletCoordinate(center)
    ? { latitude: Number(center.latitude), longitude: Number(center.longitude) }
    : validPoints[0]
      ? { latitude: validPoints[0].latitude, longitude: validPoints[0].longitude }
      : routePath[0]
        ? { latitude: routePath[0].latitude, longitude: routePath[0].longitude }
        : null;
  const preferredFocus = focusCenter && hasValidLeafletCoordinate(focusCenter)
    ? { latitude: Number(focusCenter.latitude), longitude: Number(focusCenter.longitude) }
    : null;
  const preferredZoom = typeof zoom === "number" && Number.isFinite(zoom) ? zoom : 13;
  const preferredFocusZoom = typeof focusZoom === "number" && Number.isFinite(focusZoom) ? focusZoom : 16;

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; background: ${colors.surfaceAlt}; touch-action: none; }
    body { overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; overscroll-behavior: none; }
    .empty-state { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 20px; color: ${colors.mutedText}; font-size: 14px; text-align: center; }
    .leaflet-container { touch-action: none; -ms-touch-action: none; user-select: none; -webkit-user-select: none; }
    .leaflet-control-zoom a { width: 34px; height: 34px; line-height: 34px; color: ${colors.text}; }
    .marker-pin { width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border: 3px solid #fff; border-radius: 999px 999px 999px 4px; background: var(--marker-color); color: #fff; font-size: 12px; font-weight: 800; box-shadow: 0 8px 18px rgba(15, 23, 42, 0.22); transform: rotate(-45deg); }
    .marker-pin span { transform: rotate(45deg); }
    .leaflet-popup-content-wrapper { border-radius: 12px; }
    .leaflet-popup-content { margin: 10px 12px; color: ${colors.text}; font-size: 13px; line-height: 18px; }
  </style>
</head>
<body>
  <div id="map"><div class="empty-state">Cargando mapa...</div></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    (function () {
      var points = ${jsonForInlineScript(validPoints)};
      var routePath = ${jsonForInlineScript(routePath)};
      var preferredCenter = ${jsonForInlineScript(preferredCenter)};
      var preferredFocus = ${jsonForInlineScript(preferredFocus)};
      var preferredZoom = ${jsonForInlineScript(preferredZoom)};
      var preferredFocusZoom = ${jsonForInlineScript(preferredFocusZoom)};
      var interactive = ${interactive ? "true" : "false"};
      var mapElement = document.getElementById("map");
      var RNW = window.ReactNativeWebView;

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

      if (!preferredCenter) {
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
        touchZoom: "center",
        doubleClickZoom: interactive
      });

      map.touchZoom.enable();
      map.dragging.enable();
      if (interactive) {
        map.doubleClickZoom.enable();
      }
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19
      }).addTo(map);

      var latLngs = [];
      points.forEach(function (point, index) {
        var icon = L.divIcon({
          className: "",
          html: '<div class="marker-pin" style="--marker-color: ' + point.color + '"><span>' + (index + 1) + '</span></div>',
          iconAnchor: [15, 30],
          iconSize: [30, 30],
          popupAnchor: [0, -28]
        });

        var marker = L.marker([point.latitude, point.longitude], {
          icon: icon,
          title: point.label,
          draggable: interactive && point.draggable
        }).addTo(map);

        marker.bindPopup("<strong>" + point.label + "</strong><br />" + point.latitude.toFixed(5) + ", " + point.longitude.toFixed(5));
        marker.on("dragend", function () {
          var position = marker.getLatLng();
          RNW && RNW.postMessage(JSON.stringify({ type: "coordinate", markerId: point.id, latitude: position.lat, longitude: position.lng }));
        });
        latLngs.push([point.latitude, point.longitude]);
      });

      var routeLatLngs = routePath.map(function (point) { return [point.latitude, point.longitude]; });
      if (routeLatLngs.length > 1) {
        L.polyline(routeLatLngs, { color: "${colors.accent}", opacity: 0.86, weight: 5, lineCap: "round", lineJoin: "round" }).addTo(map);
        map.fitBounds(L.latLngBounds(routeLatLngs.concat(latLngs)), { maxZoom: 16, padding: [28, 28] });
      } else if (latLngs.length > 1) {
        L.polyline(latLngs, { color: "${colors.accent}", opacity: 0.78, weight: 4 }).addTo(map);
        map.fitBounds(L.latLngBounds(latLngs), { maxZoom: 16, padding: [28, 28] });
      } else {
        map.setView(latLngs[0] || [preferredCenter.latitude, preferredCenter.longitude], preferredZoom);
      }

      if (preferredFocus) {
        map.setView([preferredFocus.latitude, preferredFocus.longitude], preferredFocusZoom);
      }

      if (interactive) {
        map.on("click", function (event) {
          RNW && RNW.postMessage(JSON.stringify({ type: "coordinate", latitude: event.latlng.lat, longitude: event.latlng.lng }));
        });
      }

      setTimeout(function () { map.invalidateSize(); }, 100);
    })();
  </script>
</body>
</html>`;
}

export function LeafletMapView({
  points,
  markers,
  path,
  center,
  focusCenter,
  focusZoom,
  zoom,
  accessibilityLabel = "Mapa",
  emptyMessage = "Sin ubicaciones para mostrar.",
  height = 220,
  interactive = false,
  onCoordinateChange,
  style
}: LeafletMapViewProps) {
  const mapPoints = points ?? markers ?? [];
  const validPoints = useMemo(() => normalizeLeafletMapPoints(mapPoints), [mapPoints]);
  const hasPath = Boolean(path?.some(hasValidLeafletCoordinate));
  const html = useMemo(
    () => buildInteractiveLeafletHtml({ points: mapPoints, path, center, focusCenter, focusZoom, zoom, interactive }),
    [center, focusCenter, focusZoom, interactive, mapPoints, path, zoom]
  );

  function handleMessage(event: WebViewMessageEvent) {
    if (!onCoordinateChange) return;
    try {
      const payload = JSON.parse(event.nativeEvent.data) as {
        type?: string;
        latitude?: number;
        longitude?: number;
        markerId?: string;
      };
      if (payload.type !== "coordinate") return;
      if (!hasValidLeafletCoordinate({ latitude: payload.latitude, longitude: payload.longitude })) return;
      onCoordinateChange({ latitude: Number(payload.latitude), longitude: Number(payload.longitude) }, payload.markerId);
    } catch {
      // Ignore malformed messages from the embedded map.
    }
  }

  const hasCenter = center && hasValidLeafletCoordinate(center);
  if (!validPoints.length && !hasPath && !interactive && !hasCenter) {
    return (
      <View
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="image"
        style={[styles.frame, styles.emptyFrame, { height }, style]}
      >
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View accessibilityLabel={accessibilityLabel} accessibilityRole="image" style={[styles.frame, { height }, style]}>
      <WebView
        automaticallyAdjustContentInsets={false}
        cacheEnabled
        domStorageEnabled={false}
        javaScriptEnabled
        mixedContentMode="never"
        nestedScrollEnabled
        originWhitelist={["https://*"]}
        overScrollMode="never"
        renderLoading={() => (
          <View style={styles.loader}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}
        scrollEnabled
        setBuiltInZoomControls
        setDisplayZoomControls={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        onMessage={handleMessage}
        source={{ html, baseUrl: "https://kepedimos.com" }}
        startInLoadingState
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt
  },
  emptyFrame: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.md
  },
  emptyText: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center"
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceAlt
  },
  webview: {
    backgroundColor: colors.surfaceAlt,
    flex: 1
  }
});
