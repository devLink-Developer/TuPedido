import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppButton } from "../../components/AppButton";
import { Card } from "../../components/Card";
import { MapPreview } from "../../components/MapPreview";
import { Screen } from "../../components/Screen";
import { StateMessage } from "../../components/StateMessage";
import { TextField } from "../../components/TextField";
import { acceptDeliveryOrder, deliverDeliveryOrder, fetchDeliveryOrders, pickupDeliveryOrder } from "../../services/api";
import { useAsyncLoad } from "../../hooks/useAsyncLoad";
import { useAutoDeliveryLocationTracking } from "../../hooks/useAutoDeliveryLocationTracking";
import { useDeliveryRoute } from "../../hooks/useDeliveryRoute";
import { useOrderRealtime } from "../../hooks/useOrderRealtime";
import { useAppFeedback } from "../../state/AppFeedbackContext";
import { useAuth } from "../../state/AuthContext";
import { colors, radii, spacing } from "../../theme";
import type { Order, OrderTracking } from "../../types/api";
import type { RootStackParamList } from "../../navigation/types";
import { friendlyErrorMessage } from "../../utils/apiMessages";
import { deliveryRoutePhase } from "../../utils/deliveryRoute";
import { formatCurrency } from "../../utils/format";
import { labelForStatus } from "../../utils/labels";
import { stopDeliveryLocationTracking } from "../../tracking/backgroundLocation";

type Props = NativeStackScreenProps<RootStackParamList, "DeliveryOrderDetail">;
type DeliveryAction = "accept" | "pickup" | "deliver";

function autoTrackingLabel(status: "idle" | "starting" | "active" | "blocked" | "error") {
  if (status === "active") return "Ubicacion compartida.";
  if (status === "starting") return "Activando ubicacion.";
  if (status === "blocked") return "Falta permiso de ubicacion.";
  if (status === "error") return "Seguimiento no disponible.";
  return "Seguimiento listo al tener entrega activa.";
}

export function DeliveryOrderDetailScreen({ route, navigation }: Props) {
  const { orderId } = route.params;
  const { token } = useAuth();
  const { showDialog, showError } = useAppFeedback();
  const [tracking, setTracking] = useState<OrderTracking | null>(null);
  const [otp, setOtp] = useState("");
  const [otpFeedback, setOtpFeedback] = useState<string | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [savingAction, setSavingAction] = useState<DeliveryAction | null>(null);
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

  const { directions, routeError, points } = useDeliveryRoute(token, order, tracking);
  const { status: autoTrackingStatus } = useAutoDeliveryLocationTracking({
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

  const updateOrder = useCallback(
    async (action: DeliveryAction) => {
      if (!token || !order || savingAction) return;
      setOtpFeedback(null);
      if (action === "deliver" && order.otp_required && !otp.trim()) {
        const message = "Ingresa el codigo de entrega que ve el cliente.";
        setOtpFeedback(message);
        showError("Falta el codigo", message);
        return;
      }
      setSavingAction(action);
      try {
        const nextOrder =
          action === "accept"
            ? await acceptDeliveryOrder(token, order.id)
            : action === "pickup"
              ? await pickupDeliveryOrder(token, order.id)
              : await deliverDeliveryOrder(token, order.id, otp.trim() || null);
        setOrder(nextOrder);
        if (action === "deliver") {
          void stopDeliveryLocationTracking().catch(() => undefined);
        }
      } catch (actionError) {
        const message = friendlyErrorMessage(actionError);
        if (action === "deliver") setOtpFeedback(message);
        showError(action === "deliver" ? "No pudimos confirmar la entrega" : "Accion no disponible", message);
      } finally {
        setSavingAction(null);
      }
    },
    [order, otp, savingAction, setOrder, showError, token]
  );

  if (loading && !order) return <StateMessage title="Cargando entrega" loading />;
  if (error || !order) {
    return (
      <StateMessage
        title="Entrega no disponible"
        description={error ?? undefined}
        actionLabel="Reintentar"
        onAction={() => void reload()}
      />
    );
  }

  const phase = deliveryRoutePhase(order);
  const isDropoff = phase === "dropoff";
  const destination = order.address_full?.trim() || order.address_label?.trim() || "Sin destino";
  const isTerminal = ["delivered", "cancelled", "delivery_failed"].includes(order.status);
  const canAccept = order.delivery_status === "assigned" && !isTerminal;
  const canPickup =
    !isDropoff &&
    !isTerminal &&
    !canAccept &&
    (order.delivery_status === "heading_to_store" || ["accepted", "preparing", "ready_for_dispatch"].includes(order.status));
  const canDeliver = isDropoff && !isTerminal;

  return (
    <Screen refreshing={loading} onRefresh={() => void reload()} contentContainerStyle={styles.screenContent}>
      <View style={styles.hero}>
        <Text maxFontSizeMultiplier={1.15} style={styles.heroEyebrow}>Entrega #{order.id}</Text>
        <Text maxFontSizeMultiplier={1.2} style={styles.heroTitle} numberOfLines={2}>{destination}</Text>
        <Text maxFontSizeMultiplier={1.15} style={styles.heroMeta} numberOfLines={1}>{order.store_name}</Text>
      </View>

      {liveError ? <Text maxFontSizeMultiplier={1.15} style={styles.warning}>{liveError}</Text> : null}

      <Card style={styles.summaryCard}>
        <View style={styles.statusRow}>
          <Text maxFontSizeMultiplier={1.1} style={styles.statusPill}>{labelForStatus(order.delivery_status)}</Text>
          <Text maxFontSizeMultiplier={1.1} style={styles.metricPill}>ETA {directions?.duration_minutes ?? order.eta_minutes ?? "-"} min</Text>
        </View>
        <Text maxFontSizeMultiplier={1.15} style={styles.customerText}>Cliente: {order.customer_name}</Text>
        <View style={styles.moneyRow}>
          <Text maxFontSizeMultiplier={1.1} style={styles.moneyPill}>Cobro {formatCurrency(order.total)}</Text>
          <Text maxFontSizeMultiplier={1.1} style={styles.moneyPill}>Comision {formatCurrency(order.rider_fee)}</Text>
        </View>
        <View style={styles.trackingStatus}>
          <Text maxFontSizeMultiplier={1.15} style={styles.trackingText}>{autoTrackingLabel(autoTrackingStatus)}</Text>
        </View>
        {routeError ? <Text maxFontSizeMultiplier={1.15} style={styles.warningInline}>{routeError}</Text> : null}
      </Card>

      <View style={styles.primaryActions}>
        <AppButton title="Mapa" icon="map-outline" onPress={() => navigation.navigate("DeliveryRouteMap", { orderId: order.id })} style={styles.primaryAction} />
        {canAccept ? (
          <AppButton title="Aceptar" icon="checkmark-circle-outline" loading={savingAction === "accept"} onPress={() => void updateOrder("accept")} variant="ghost" style={styles.primaryAction} />
        ) : null}
        {canPickup ? (
          <AppButton title="Retirado" icon="bag-check-outline" loading={savingAction === "pickup"} onPress={() => void updateOrder("pickup")} variant="ghost" style={styles.primaryAction} />
        ) : null}
      </View>

      {canDeliver ? (
        <Card style={styles.deliveryCard}>
          <View style={styles.cardHeader}>
            <Text maxFontSizeMultiplier={1.15} style={styles.cardTitle}>Confirmar entrega</Text>
            {order.otp_required ? <Text maxFontSizeMultiplier={1.1} style={styles.requiredPill}>Codigo requerido</Text> : null}
          </View>
          {order.otp_required ? (
            <TextField
              label="Codigo del cliente"
              value={otp}
              onChangeText={(value) => {
                setOtp(value);
                setOtpFeedback(null);
              }}
              error={otpFeedback}
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={12}
            />
          ) : (
            <Text maxFontSizeMultiplier={1.15} style={styles.meta}>Este pedido no requiere codigo.</Text>
          )}
          <AppButton title="Marcar entregado" icon="checkmark-done-outline" loading={savingAction === "deliver"} onPress={() => void updateOrder("deliver")} fullWidth />
        </Card>
      ) : null}

      <MapPreview
        route={
          directions
            ? {
                geometry: directions.geometry,
                distanceMeters: directions.distance_meters,
                durationMinutes: directions.duration_minutes
              }
            : null
        }
        points={points}
        pointMeta={{
          rider: "Tu posicion en vivo",
          store: order.store_name,
          address: destination
        }}
      />

      <Card style={styles.productsCard}>
        <Text maxFontSizeMultiplier={1.15} style={styles.cardTitle}>Productos</Text>
        {order.items.map((item) => (
          <View key={item.id} style={styles.line}>
            <Text maxFontSizeMultiplier={1.15} style={styles.lineText}>
              {item.quantity}x {item.product_name}
            </Text>
            <Text maxFontSizeMultiplier={1.1} style={styles.lineTotal}>{formatCurrency(item.unit_price * item.quantity)}</Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    gap: spacing.md
  },
  hero: {
    gap: spacing.xs
  },
  heroEyebrow: {
    color: colors.primaryDark,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  heroTitle: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900"
  },
  heroMeta: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800"
  },
  summaryCard: {
    gap: spacing.sm
  },
  deliveryCard: {
    gap: spacing.sm
  },
  productsCard: {
    gap: spacing.sm
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  statusPill: {
    overflow: "hidden",
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    color: colors.primaryDark,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900"
  },
  metricPill: {
    overflow: "hidden",
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900"
  },
  customerText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800"
  },
  moneyRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  moneyPill: {
    overflow: "hidden",
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
    color: colors.mutedText,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900"
  },
  trackingStatus: {
    borderRadius: radii.md,
    backgroundColor: colors.successSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  trackingText: {
    color: colors.success,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "900"
  },
  primaryActions: {
    flexDirection: "row",
    gap: spacing.sm
  },
  primaryAction: {
    flex: 1
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  cardTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900"
  },
  requiredPill: {
    overflow: "hidden",
    borderRadius: radii.pill,
    backgroundColor: colors.warningSoft,
    color: colors.warning,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "900"
  },
  meta: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700"
  },
  warning: {
    color: colors.warning,
    fontWeight: "800"
  },
  warningInline: {
    color: colors.warning,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800"
  },
  line: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md
  },
  lineText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    lineHeight: 19
  },
  lineTotal: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "900"
  }
});
