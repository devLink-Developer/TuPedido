import { Ionicons } from "@expo/vector-icons";
import { useCallback, useMemo, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppButton } from "../../components/AppButton";
import { IconButton } from "../../components/IconButton";
import { LeafletMapView } from "../../components/LeafletMapView";
import { StateMessage } from "../../components/StateMessage";
import { TextField } from "../../components/TextField";
import { useAsyncLoad } from "../../hooks/useAsyncLoad";
import { useAutoDeliveryLocationTracking } from "../../hooks/useAutoDeliveryLocationTracking";
import { useDeliveryRoute } from "../../hooks/useDeliveryRoute";
import { useOrderRealtime } from "../../hooks/useOrderRealtime";
import { useVoiceDirections } from "../../hooks/useVoiceDirections";
import { deliverDeliveryOrder, fetchDeliveryOrders } from "../../services/api";
import { useAppFeedback } from "../../state/AppFeedbackContext";
import { useAuth } from "../../state/AuthContext";
import { stopDeliveryLocationTracking } from "../../tracking/backgroundLocation";
import { colors, opacity, radii, shadow, spacing, touchTarget } from "../../theme";
import type { Order, OrderTracking, RouteCoordinate } from "../../types/api";
import type { RootStackParamList } from "../../navigation/types";
import { friendlyErrorMessage } from "../../utils/apiMessages";
import { deliveryRoutePhase, getRiderCoordinate, normalizeRiderInstructionText } from "../../utils/deliveryRoute";
import { formatDistance, formatMinutes } from "../../utils/format";
import { labelForStatus } from "../../utils/labels";
import { getRiderCustomerName, getRiderDeliveryAddress } from "../../utils/deliveryOrderDisplay";

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
  const { showDialog, showError, showToast } = useAppFeedback();
  const [tracking, setTracking] = useState<OrderTracking | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [mapFocusCenter, setMapFocusCenter] = useState<RouteCoordinate | null>(null);
  const [deliveryCodeVisible, setDeliveryCodeVisible] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpFeedback, setOtpFeedback] = useState<string | null>(null);
  const [deliverySubmitting, setDeliverySubmitting] = useState(false);
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

  const instructions = useMemo(
    () => (directions?.instructions ?? []).map((instruction) => ({
      ...instruction,
      instruction: normalizeRiderInstructionText(instruction.instruction)
    })),
    [directions?.instructions]
  );
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
  const routePhase = order ? deliveryRoutePhase(order) : "pickup";
  const isDropoff = routePhase === "dropoff";
  const riderLocation = order ? getRiderCoordinate(order, tracking) : null;
  const destinationText = isDropoff
    ? (order ? getRiderDeliveryAddress(order) : "Direccion del cliente no disponible")
    : order?.store_name?.trim() || "Comercio";
  const destinationMeta = isDropoff && order ? `Cliente: ${getRiderCustomerName(order)}` : "Retiro en comercio";
  const currentInstruction = instructions[0] ?? null;
  const canCompleteDelivery = isDropoff && !["delivered", "cancelled", "delivery_failed"].includes(order?.status ?? "");
  const showDeliveryCodePanel = canCompleteDelivery && Boolean(order?.otp_required);

  const focusRiderLocation = useCallback(() => {
    if (!riderLocation) return;
    setMapFocusCenter({ latitude: riderLocation.latitude, longitude: riderLocation.longitude });
  }, [riderLocation]);

  const handleDeliver = useCallback(async () => {
    if (!token || !order || !canCompleteDelivery) return;
    setOtpFeedback(null);
    if (order.otp_required && !otp.trim()) {
      const message = "Ingresa el codigo de entrega que ve el cliente.";
      setOtpFeedback(message);
      showError("Falta el codigo", message);
      return;
    }
    setDeliverySubmitting(true);
    try {
      const nextOrder = await deliverDeliveryOrder(token, order.id, otp.trim() || null);
      setOrder(nextOrder);
      setOtp("");
      setDeliveryCodeVisible(false);
      showToast("Entrega confirmada", { variant: "success" });
      void stopDeliveryLocationTracking().catch(() => undefined);
    } catch (actionError) {
      const message = friendlyErrorMessage(actionError);
      setOtpFeedback(message);
      showError("No pudimos confirmar la entrega", message);
    } finally {
      setDeliverySubmitting(false);
    }
  }, [canCompleteDelivery, order, otp, setOrder, showError, showToast, token]);

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
        focusCenter={mapFocusCenter}
        focusZoom={17}
        height={mapHeight}
        zoom={15}
        accessibilityLabel="Mapa de ruta del pedido activo"
        style={styles.fullMap}
      />

      <SafeAreaView pointerEvents="box-none" style={styles.overlay}>
        <View pointerEvents="box-none" style={styles.mapTopLayer}>
          <View pointerEvents="box-none" style={styles.topBar}>
            <IconButton icon="chevron-back" label="Volver" tone="dark" onPress={() => navigation.goBack()} />
            <View style={styles.headerCard}>
              <Text maxFontSizeMultiplier={1.1} style={styles.eyebrow}>{destinationLabel} - {title}</Text>
              <Text maxFontSizeMultiplier={1.15} style={styles.title} numberOfLines={isDropoff ? 3 : 2}>
                {destinationText}
              </Text>
              <Text maxFontSizeMultiplier={1.1} style={styles.meta} numberOfLines={1}>
                Pedido #{order.id} - {labelForStatus(order.delivery_status)}
              </Text>
            </View>
            <IconButton
              icon="document-text-outline"
              label="Ver detalle"
              tone="dark"
              onPress={() => navigation.navigate("DeliveryOrderDetail", { orderId: order.id })}
            />
          </View>

          <View pointerEvents="box-none" style={styles.mapControls}>
            <IconButton
              icon="locate-outline"
              label="Centrar en mi ubicacion"
              disabled={!riderLocation}
              onPress={focusRiderLocation}
            />
            {showDeliveryCodePanel ? (
              <IconButton
                icon="keypad-outline"
                label="Ingresar codigo de entrega"
                tone="primary"
                onPress={() => setDeliveryCodeVisible(true)}
              />
            ) : null}
          </View>
        </View>

        <View style={[styles.bottomSheet, { maxHeight: sheetExpanded ? Math.min(440, Math.max(320, height * 0.5)) : Math.min(250, Math.max(210, height * 0.33)) }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={sheetExpanded ? "Ocultar indicaciones" : "Mostrar indicaciones"}
            accessibilityState={{ expanded: sheetExpanded }}
            android_ripple={{ color: colors.borderStrong, borderless: false }}
            onPress={() => setSheetExpanded((value) => !value)}
            style={({ pressed }) => [styles.sheetToggle, pressed && styles.pressed]}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.sheetToggleRow}>
              <Text style={styles.sheetToggleText}>{sheetExpanded ? "Ocultar indicaciones" : "Mostrar indicaciones"}</Text>
              <Ionicons name={sheetExpanded ? "chevron-down" : "chevron-up"} size={19} color={colors.text} />
            </View>
          </Pressable>
          <ScrollView style={styles.sheetBody} contentContainerStyle={styles.sheetBodyContent} showsVerticalScrollIndicator={false} nestedScrollEnabled>
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

            <View style={styles.destinationCard}>
              <View style={styles.destinationIcon}>
                <Ionicons name={isDropoff ? "home-outline" : "storefront-outline"} size={20} color={colors.primary} />
              </View>
              <View style={styles.destinationCopy}>
                <Text maxFontSizeMultiplier={1.1} style={styles.destinationMeta}>{destinationMeta}</Text>
                <Text maxFontSizeMultiplier={1.15} style={styles.destinationText} numberOfLines={sheetExpanded && isDropoff ? 4 : 2}>{destinationText}</Text>
                {sheetExpanded && currentInstruction ? (
                  <Text maxFontSizeMultiplier={1.15} style={styles.nextInstruction} numberOfLines={3}>
                    {currentInstruction.instruction}
                  </Text>
                ) : null}
              </View>
            </View>

            <View style={styles.voicePanel}>
              <View style={styles.voiceHeader}>
                <View style={styles.voiceTitleRow}>
                  <Ionicons
                    name={voice.voiceEnabled ? "volume-high-outline" : "volume-mute-outline"}
                    size={18}
                    color={voice.voiceEnabled ? colors.primary : colors.mutedText}
                  />
                  <View>
                    <Text maxFontSizeMultiplier={1.1} style={styles.voiceTitle}>Voz de ruta</Text>
                    <Text maxFontSizeMultiplier={1.1} style={styles.voiceMeta}>{voice.voiceEnabled ? "Activa" : "Silenciada"}</Text>
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
                </View>
              </View>
            </View>

            {sheetExpanded ? (
              <>
                <Text style={styles.sheetTitle}>Indicaciones</Text>
                {instructions.length ? (
                  <View style={styles.instructions}>
                    {instructions.slice(0, 8).map((instruction, index) => (
                      <View key={`${instruction.instruction}-${index}`} style={styles.instructionRow}>
                        <Text style={styles.instructionIndex}>{index + 1}</Text>
                        <View style={styles.instructionCopy}>
                          <Text maxFontSizeMultiplier={1.15} style={styles.instructionText}>{instruction.instruction}</Text>
                          <Text maxFontSizeMultiplier={1.1} style={styles.instructionMeta}>
                            {formatDistance(instruction.distance_meters)} - {formatMinutes(instruction.duration_minutes)}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text maxFontSizeMultiplier={1.15} style={styles.emptyInstructions}>
                    Cuando la ruta este calculada, las indicaciones paso a paso apareceran aca.
                  </Text>
                )}
              </>
            ) : null}
          </ScrollView>
        </View>
      </SafeAreaView>

      <Modal animationType="slide" transparent visible={deliveryCodeVisible} onRequestClose={() => setDeliveryCodeVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 16}
          style={styles.modalOverlay}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setDeliveryCodeVisible(false)} />
          <ScrollView
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.codeScroller}
            contentContainerStyle={styles.codeSheet}
          >
            <View style={styles.codeHeader}>
                <View style={styles.codeIcon}>
                  <Ionicons name="keypad-outline" size={22} color={colors.primary} />
                </View>
                <View style={styles.codeCopy}>
                  <Text maxFontSizeMultiplier={1.15} style={styles.codeTitle}>Codigo de entrega</Text>
                  <Text maxFontSizeMultiplier={1.2} style={styles.codeMeta}>
                    {destinationText}
                  </Text>
                </View>
                <IconButton icon="close" label="Cerrar codigo de entrega" onPress={() => setDeliveryCodeVisible(false)} />
              </View>
              <Text maxFontSizeMultiplier={1.2} style={styles.codeHelp}>
                Pedile al cliente el codigo y confirmalo sin salir del mapa.
              </Text>
              <TextField
                label="Codigo"
                value={otp}
                onChangeText={(value) => {
                  setOtp(value);
                  setOtpFeedback(null);
                }}
                error={otpFeedback}
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={12}
                autoFocus
              />
              <AppButton
                title="Marcar entregado"
                icon="checkmark-done-outline"
                loading={deliverySubmitting}
                onPress={() => void handleDeliver()}
                fullWidth
              />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
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
  mapTopLayer: {
    zIndex: 3
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    zIndex: 3
  },
  mapControls: {
    alignSelf: "flex-end",
    marginTop: spacing.sm,
    marginRight: spacing.md,
    gap: spacing.sm,
    zIndex: 2,
    elevation: 2
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
    overflow: "hidden",
    ...shadow.medium
  },
  sheetBody: {
    flexGrow: 0
  },
  sheetBodyContent: {
    paddingBottom: spacing.sm
  },
  sheetToggle: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs
  },
  sheetHandle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.xs
  },
  sheetToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  sheetToggleText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900"
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
  destinationCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginTop: spacing.sm
  },
  destinationIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  destinationCopy: {
    flex: 1,
    minWidth: 0
  },
  destinationMeta: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "900"
  },
  destinationText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    marginTop: 2
  },
  nextInstruction: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 17,
    marginTop: spacing.xs
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
  sheetTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    marginTop: spacing.md,
    marginBottom: spacing.sm
  },
  instructions: {
    gap: 0
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
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.42)"
  },
  codeSheet: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    backgroundColor: colors.surface,
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
    ...shadow.medium
  },
  codeScroller: {
    flexGrow: 0,
    maxHeight: "88%"
  },
  codeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  codeIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft
  },
  codeCopy: {
    flex: 1,
    minWidth: 0
  },
  codeTitle: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "900"
  },
  codeMeta: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2
  },
  codeHelp: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700"
  }
});
