import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { MAP_INITIAL_REGION } from "../config/env";
import { colors, radii, spacing } from "../theme";
import type { RouteCoordinate } from "../types/api";
import { formatDistance, formatMinutes } from "../utils/format";
import { hasValidLeafletCoordinate } from "../utils/leafletMap";
import { LeafletMapView, type LeafletMapMarker } from "./LeafletMapView";

export type MapPreviewPoint = {
  id: string;
  label: string;
  meta?: string | null;
  latitude: number | null;
  longitude: number | null;
  color: string;
};

export type MapPreviewRoute = {
  geometry: RouteCoordinate[];
  distanceMeters?: number | null;
  durationMinutes?: number | null;
};

type MapPreviewProps = {
  points: MapPreviewPoint[];
  route?: MapPreviewRoute | null;
  pointMeta?: Record<string, string | null | undefined>;
};

export function MapPreview({ points, route, pointMeta }: MapPreviewProps) {
  const validPoints = points.filter(hasValidLeafletCoordinate);
  const hasRoute = Boolean(route?.geometry?.length);
  const markers: LeafletMapMarker[] = points.map((point) => ({
    id: point.id,
    label: point.label,
    latitude: point.latitude,
    longitude: point.longitude,
    color: point.color
  }));
  const firstPoint = validPoints[0];
  const center = firstPoint
    ? { latitude: Number(firstPoint.latitude), longitude: Number(firstPoint.longitude) }
    : { latitude: MAP_INITIAL_REGION.latitude, longitude: MAP_INITIAL_REGION.longitude };

  return (
    <View style={styles.card} accessibilityLabel="Recorrido del pedido">
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="navigate-outline" size={22} color={colors.primary} />
        </View>
        <View style={styles.headerText}>
          <Text maxFontSizeMultiplier={1.15} style={styles.title}>Recorrido del pedido</Text>
          <Text maxFontSizeMultiplier={1.2} style={styles.subtitle}>
            {hasRoute
              ? "Ruta estimada con actualizaciones en vivo."
              : validPoints.length
                ? "Ubicaciones disponibles para seguimiento."
                : "Aun no hay ubicaciones disponibles."}
          </Text>
        </View>
      </View>

      {validPoints.length ? (
        <LeafletMapView markers={markers} path={route?.geometry} center={center} height={190} zoom={14} accessibilityLabel="Mapa del recorrido del pedido" />
      ) : null}

      {hasRoute ? (
        <View style={styles.routeMeta}>
          {typeof route?.distanceMeters === "number" ? <Text maxFontSizeMultiplier={1.1} style={styles.routeMetaText}>{formatDistance(route.distanceMeters)}</Text> : null}
          {typeof route?.durationMinutes === "number" ? <Text maxFontSizeMultiplier={1.1} style={styles.routeMetaText}>{formatMinutes(route.durationMinutes)}</Text> : null}
        </View>
      ) : null}

      <View style={styles.timeline}>
        {points.map((point, index) => {
          const hasLocation = hasValidLeafletCoordinate(point);
          const meta = point.meta ?? pointMeta?.[point.id] ?? (hasLocation ? "Ubicacion registrada" : "Sin ubicacion");
          return (
            <View key={point.id} style={styles.pointRow}>
              <View style={styles.pointRail}>
                <View style={[styles.pointDot, { backgroundColor: point.color }]} />
                {index < points.length - 1 ? <View style={styles.pointLine} /> : null}
              </View>
              <View style={styles.pointCopy}>
                <Text maxFontSizeMultiplier={1.15} style={styles.pointLabel}>{point.label}</Text>
                <Text maxFontSizeMultiplier={1.1} style={styles.pointMeta} numberOfLines={2}>
                  {meta}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.md
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  headerText: {
    flex: 1,
    minWidth: 0
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  subtitle: {
    color: colors.mutedText,
    marginTop: 2,
    lineHeight: 19
  },
  timeline: {
    gap: spacing.sm
  },
  routeMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  routeMetaText: {
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  pointRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  pointRail: {
    width: 24,
    alignItems: "center"
  },
  pointDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginTop: 3
  },
  pointLine: {
    width: 2,
    flex: 1,
    minHeight: 28,
    backgroundColor: colors.border,
    marginTop: spacing.xs
  },
  pointCopy: {
    flex: 1,
    minWidth: 0,
    paddingBottom: spacing.xs
  },
  pointLabel: {
    color: colors.text,
    fontWeight: "900"
  },
  pointMeta: {
    color: colors.mutedText,
    marginTop: 2,
    fontSize: 13
  }
});
