import { Ionicons } from "@expo/vector-icons";
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { IconButton } from "../../components/IconButton";
import { LeafletMapView } from "../../components/LeafletMapView";
import { StateMessage } from "../../components/StateMessage";
import { useAsyncLoad } from "../../hooks/useAsyncLoad";
import { useAutoDeliveryLocationTracking } from "../../hooks/useAutoDeliveryLocationTracking";
import { useDeliveryRoute } from "../../hooks/useDeliveryRoute";
import { useOrderRealtime } from "../../hooks/useOrderRealtime";
import { useVoiceDirections } from "../../hooks/useVoiceDirections";
import { fetchDeliveryOrders } from "../../services/api";
import { useAppFeedback } from "../../state/AppFeedbackContext";
import { useAuth } from "../../state/AuthContext";
import { colors, opacity, radii, shadow, spacing, touchTarget } from "../../theme";
import type { Order, OrderTracking } from "../../types/api";
import type { RootStackParamList } from "../../navigation/types";
import { formatDistance, formatMinutes } from "../../utils/format";
import { labelForStatus } from "../../utils/labels";

type Props = NativeStackScreenProps<RootStackParamList, "DeliveryRouteMap">;
const VOLUME_SEGMENTS = [0.2, 0.4, 0.6, 0.8, 1];

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
  const voice = useVoiceDirections({ orderId, routeTitle: title, instructions });
  const mapHeight = Math.max(420, height);
  const routeMeta = useMemo(
    () =>
      directions
        ? [formatDistance(directions.distance_meters), formatMinutes(directions.duration_minutes)]
        : ["Ruta pendiente"],
    [directions]
  );
  const voicePlaybackDisabled = !instructions.length || !voice.voiceEnabled;

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

        <View style={[styles.bottomSheet, { maxHeight: Math.min(460, Math.max(360, height * 0.56)) }]}>
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
          {voice.speechError ? <Text style={styles.warning}>{voice.speechError}</Text> : null}

          <View style={styles.voicePanel}>
            <View style={styles.voiceHeader}>
              <View style={styles.voiceTitleRow}>
                <Ionicons
                  name={voice.voiceEnabled ? "volume-high-outline" : "volume-mute-outline"}
                  size={18}
                  color={voice.voiceEnabled ? colors.primary : colors.mutedText}
                />
                <View>
                  <Text style={styles.voiceTitle}>Voz de ruta</Text>
                  <Text style={styles.voiceMeta}>{voice.voiceEnabled ? `Volumen ${voice.volumePercent}%` : "Silenciada"}</Text>
                </View>
              </View>
              <View style={styles.voiceActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={voice.voiceEnabled ? "Silenciar indicaciones" : "Activar indicaciones por voz"}
                  android_ripple={{ color: colors.borderStrong, borderless: false }}
                  hitSlop={6}
                  onPress={voice.toggleVoice}
                  style={({ pressed }) => [styles.voiceAction, pressed && styles.pressed]}
                >
                  <Ionicons name={voice.voiceEnabled ? "volume-mute-outline" : "volume-high-outline"} size={20} color={colors.text} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Repetir proxima indicacion"
                  accessibilityState={{ disabled: voicePlaybackDisabled }}
                  android_ripple={!voicePlaybackDisabled ? { color: colors.borderStrong, borderless: false } : undefined}
                  disabled={voicePlaybackDisabled}
                  hitSlop={6}
                  onPress={() => voice.speakCurrentInstruction({ force: true })}
                  style={({ pressed }) => [styles.voiceAction, pressed && styles.pressed, voicePlaybackDisabled && styles.disabledAction]}
                >
                  <Ionicons name="repeat-outline" size={20} color={!voicePlaybackDisabled ? colors.text : colors.mutedText} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={voice.isSpeaking ? "Detener indicaciones por voz" : "Leer indicaciones visibles"}
                  accessibilityState={{ disabled: voicePlaybackDisabled }}
                  android_ripple={!voicePlaybackDisabled ? { color: colors.borderStrong, borderless: false } : undefined}
                  disabled={voicePlaybackDisabled}
                  hitSlop={6}
                  onPress={voice.isSpeaking ? voice.stop : voice.speakRouteOverview}
                  style={({ pressed }) => [styles.voiceAction, pressed && styles.pressed, voicePlaybackDisabled && styles.disabledAction]}
                >
                  <Ionicons name={voice.isSpeaking ? "stop-circle-outline" : "play-circle-outline"} size={21} color={!voicePlaybackDisabled ? colors.text : colors.mutedText} />
                </Pressable>
              </View>
            </View>

            <View style={styles.volumeRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Bajar volumen de indicaciones"
                android_ripple={{ color: colors.borderStrong, borderless: false }}
                hitSlop={6}
                onPress={voice.decreaseVolume}
                style={({ pressed }) => [styles.volumeStepButton, pressed && styles.pressed]}
              >
                <Ionicons name="remove" size={19} color={colors.text} />
              </Pressable>
              <View
                accessibilityActions={[{ name: "increment", label: "Subir volumen" }, { name: "decrement", label: "Bajar volumen" }]}
                accessibilityLabel="Volumen de indicaciones"
                accessibilityRole="adjustable"
                accessibilityValue={{ text: `${voice.volumePercent}%` }}
                onAccessibilityAction={(event) => {
                  if (event.nativeEvent.actionName === "increment") {
                    voice.increaseVolume();
                  } else if (event.nativeEvent.actionName === "decrement") {
                    voice.decreaseVolume();
                  }
                }}
                style={styles.volumeTrack}
              >
                {VOLUME_SEGMENTS.map((value) => {
                  const active = value <= voice.volume + 0.01;
                  return (
                    <Pressable
                      key={value}
                      accessibilityRole="button"
                      accessibilityLabel={`Volumen ${Math.round(value * 100)}%`}
                      hitSlop={6}
                      onPress={() => voice.setVolume(value)}
                      style={({ pressed }) => [
                        styles.volumeSegment,
                        active && styles.volumeSegmentActive,
                        pressed && styles.pressed
                      ]}
                    />
                  );
                })}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Subir volumen de indicaciones"
                android_ripple={{ color: colors.borderStrong, borderless: false }}
                hitSlop={6}
                onPress={voice.increaseVolume}
                style={({ pressed }) => [styles.volumeStepButton, pressed && styles.pressed]}
              >
                <Ionicons name="add" size={19} color={colors.text} />
              </Pressable>
            </View>
          </View>

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
  voicePanel: {
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginTop: spacing.sm
  },
  voiceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  voiceTitleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  voiceTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900"
  },
  voiceMeta: {
    color: colors.mutedText,
    fontSize: 12,
    marginTop: 1
  },
  voiceActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  voiceAction: {
    width: touchTarget.min,
    height: touchTarget.min,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  disabledAction: {
    opacity: opacity.disabled
  },
  pressed: {
    opacity: opacity.pressed
  },
  volumeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  volumeStepButton: {
    width: touchTarget.min,
    height: touchTarget.min,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  volumeTrack: {
    flex: 1,
    minHeight: touchTarget.min,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  volumeSegment: {
    flex: 1,
    height: 16,
    borderRadius: radii.pill,
    backgroundColor: colors.borderStrong
  },
  volumeSegmentActive: {
    backgroundColor: colors.primary
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
