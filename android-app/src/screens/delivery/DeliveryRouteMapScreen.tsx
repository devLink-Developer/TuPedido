import { Ionicons } from "@expo/vector-icons";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { IconButton } from "../../components/IconButton";
import { LeafletMapView } from "../../components/LeafletMapView";
import { StateMessage } from "../../components/StateMessage";
import { useAsyncLoad } from "../../hooks/useAsyncLoad";
import { useAutoDeliveryLocationTracking } from "../../hooks/useAutoDeliveryLocationTracking";
import { useDeliveryRoute } from "../../hooks/useDeliveryRoute";
import { useOrderRealtime } from "../../hooks/useOrderRealtime";
import { fetchDeliveryOrders } from "../../services/api";
import { useAppFeedback } from "../../state/AppFeedbackContext";
import { useAuth } from "../../state/AuthContext";
import { colors, radii, shadow, spacing } from "../../theme";
import type { Order, OrderTracking } from "../../types/api";
import type { RootStackParamList } from "../../navigation/types";
import { formatDistance, formatMinutes } from "../../utils/format";
import { labelForStatus } from "../../utils/labels";

type Props = NativeStackScreenProps<RootStackParamList, "DeliveryRouteMap">;

function trackingStatusLabel(status: "idle" | "starting" | "active" | "blocked" | "error") {
  if (status === "active") return "Ubicacion compartida";
  if (status === "starting") return "Activando ubicacion";
  if (status === "blocked") return "Permiso pendiente";
  if (status === "error") return "Seguimiento no disponible";
  return "Seguimiento en espera";
}

export function DeliveryRouteMapScreen({ route, navigation }: Props) {
  const { orderId } = route.params;
  const { height } = useWindowDimensions();
  const { token } = useAuth();
  const { showDialog, showError } = useAppFeedback();
  const [tracking, setTracking] = useState<OrderTracking | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const { data: order, setData: setOrder, loading, error, reload } = useAsyncLoad<Order>(
    async () => {
      if (!token) throw new Error("Sesion no disponible");
      const orders = await fetchDeliveryOrders(token);
      const match = orders.find((item) => item.id === orderId);
      if (!match) throw new Error("Pedido no asignado al repartidor");
      return match;
    },
    [orderId, token]
  );

  const pollAssignedOrder = useCallback(async () => {
    if (!token) return null;
    const orders = await fetchDeliveryOrders(token);
    return orders.find((item) => item.id === orderId) ?? null;
  }, [orderId, token]);

  useOrderRealtime({
    token,
    orderId,
    enabled: Boolean(order && !["delivered", "cancelled", "delivery_failed"].includes(order.status)),
    onOrder: setOrder,
    onTracking: setTracking,
    onError: setLiveError,
    pollOrder: pollAssignedOrder
  });

  const { directions, routeError, points, origin, title, destinationLabel } = useDeliveryRoute(token, order, tracking);
  const { status: trackingStatus } = useAutoDeliveryLocationTracking({
    token,
    order,
    onPermissionBlocked: (message) =>
      showDialog({
        title: "Ubicacion requerida",
        message: message ?? "Habilita la ubicacion para que el cliente pueda seguir el pedido.",
        variant: "warning"
      }),
    onError: (message) => showError("Seguimiento automatico", message)
  });

  const instructions = directions?.instructions ?? [];
  const mapHeight = Math.max(420, height);
  const routeMeta = useMemo(
    () =>
      directions
        ? [formatDistance(directions.distance_meters), formatMinutes(directions.duration_minutes)]
        : ["Ruta pendiente"],
    [directions]
  );

  if (loading && !order) {
    return <StateMessage title="Cargando ruta" loading />;
  }
  if (error || !order) {
    return (
      <StateMessage
        title="Ruta no disponible"
        description={error ?? undefined}
        actionLabel="Reintentar"
        onAction={() => void reload()}
      />
    );
  }

  return (
    <View style={styles.root}>
      <LeafletMapView
        markers={points}
        path={directions?.geometry}
        center={origin}
        height={mapHeight}
        zoom={15}
        accessibilityLabel="Mapa de ruta del pedido activo"
        style={styles.fullMap}
      />

      <SafeAreaView pointerEvents="box-none" style={styles.overlay}>
        <View pointerEvents="box-none" style={styles.topBar}>
          <IconButton icon="chevron-back" label="Volver" tone="dark" onPress={() => navigation.goBack()} />
          <View style={styles.headerCard}>
            <Text style={styles.eyebrow}>{destinationLabel}</Text>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              Pedido #{order.id} - {labelForStatus(order.delivery_status)}
            </Text>
          </View>
          <IconButton icon="document-text-outline" label="Ver detalle" tone="dark" onPress={() => navigation.navigate("DeliveryOrderDetail", { orderId: order.id })} />
        </View>

        <View style={styles.bottomSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.statusRow}>
            <View style={styles.statusPill}>
              <Ionicons
                name={trackingStatus === "active" ? "radio-button-on" : "radio-button-off"}
                size={16}
                color={trackingStatus === "active" ? colors.success : colors.warning}
              />
              <Text style={styles.statusText}>{trackingStatusLabel(trackingStatus)}</Text>
            </View>
            {routeMeta.map((item) => (
              <Text key={item} style={styles.metricPill}>
                {item}
              </Text>
            ))}
          </View>
          {liveError || routeError ? <Text style={styles.warning}>{liveError ?? routeError}</Text> : null}

          <Text style={styles.sheetTitle}>Indicaciones</Text>
          {instructions.length ? (
            <ScrollView style={styles.instructions} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {instructions.slice(0, 8).map((instruction, index) => (
                <View key={`${instruction.instruction}-${index}`} style={styles.instructionRow}>
                  <Text style={styles.instructionIndex}>{index + 1}</Text>
                  <View style={styles.instructionCopy}>
                    <Text style={styles.instructionText}>{instruction.instruction}</Text>
                    <Text style={styles.instructionMeta}>
                      {formatDistance(instruction.distance_meters)} - {formatMinutes(instruction.duration_minutes)}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.emptyInstructions}>
              Cuando la ruta este calculada, las indicaciones paso a paso apareceran aca.
            </Text>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surfaceAlt
  },
  fullMap: {
    borderRadius: 0,
    borderWidth: 0
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between"
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm
  },
  headerCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: radii.lg,
    backgroundColor: "rgba(255,255,255,0.94)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...shadow.soft
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    marginTop: 2
  },
  meta: {
    color: colors.mutedText,
    fontSize: 12,
    marginTop: 2
  },
  bottomSheet: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    backgroundColor: "rgba(255,255,255,0.96)",
    padding: spacing.md,
    maxHeight: 330,
    ...shadow.medium
  },
  sheetHandle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.md
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  statusPill: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md
  },
  statusText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900"
  },
  metricPill: {
    overflow: "hidden",
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    color: colors.primaryDark,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 12,
    fontWeight: "900"
  },
  warning: {
    color: colors.warning,
    fontWeight: "800",
    lineHeight: 18,
    marginTop: spacing.sm
  },
  sheetTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    marginTop: spacing.md,
    marginBottom: spacing.sm
  },
  instructions: {
    maxHeight: 160
  },
  instructionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  instructionIndex: {
    width: 28,
    height: 28,
    overflow: "hidden",
    borderRadius: 14,
    backgroundColor: colors.text,
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 28,
    fontWeight: "900"
  },
  instructionCopy: {
    flex: 1,
    minWidth: 0
  },
  instructionText: {
    color: colors.text,
    fontWeight: "800",
    lineHeight: 19
  },
  instructionMeta: {
    color: colors.mutedText,
    marginTop: 2,
    fontSize: 12
  },
  emptyInstructions: {
    color: colors.mutedText,
    lineHeight: 20
  }
});
