import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppButton } from "../../components/AppButton";
import { Card } from "../../components/Card";
import { MapPreview } from "../../components/MapPreview";
import { Screen } from "../../components/Screen";
import { SectionHeader } from "../../components/SectionHeader";
import { StateMessage } from "../../components/StateMessage";
import { TextField } from "../../components/TextField";
import { acceptDeliveryOrder, deliverDeliveryOrder, fetchDeliveryOrders, pickupDeliveryOrder } from "../../services/api";
import { useAsyncLoad } from "../../hooks/useAsyncLoad";
import { useAutoDeliveryLocationTracking } from "../../hooks/useAutoDeliveryLocationTracking";
import { useDeliveryRoute } from "../../hooks/useDeliveryRoute";
import { useOrderRealtime } from "../../hooks/useOrderRealtime";
import { useAppFeedback } from "../../state/AppFeedbackContext";
import { useAuth } from "../../state/AuthContext";
import { colors, spacing } from "../../theme";
import type { Order, OrderTracking } from "../../types/api";
import type { RootStackParamList } from "../../navigation/types";
import { friendlyErrorMessage } from "../../utils/apiMessages";
import { formatCurrency } from "../../utils/format";
import { labelForStatus } from "../../utils/labels";
import { stopDeliveryLocationTracking } from "../../tracking/backgroundLocation";

type Props = NativeStackScreenProps<RootStackParamList, "DeliveryOrderDetail">;

function autoTrackingLabel(status: "idle" | "starting" | "active" | "blocked" | "error") {
  if (status === "active") return "Ubicacion compartida automaticamente.";
  if (status === "starting") return "Activando seguimiento de ubicacion.";
  if (status === "blocked") return "Falta permiso de ubicacion para compartir el recorrido.";
  if (status === "error") return "No se pudo activar el seguimiento automatico.";
  return "El seguimiento se activa al tener una entrega asignada.";
}

export function DeliveryOrderDetailScreen({ route, navigation }: Props) {
  const { orderId } = route.params;
  const { token } = useAuth();
  const { showDialog, showError } = useAppFeedback();
  const [tracking, setTracking] = useState<OrderTracking | null>(null);
  const [otp, setOtp] = useState("");
  const [otpFeedback, setOtpFeedback] = useState<string | null>(null);
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
    async (action: "accept" | "pickup" | "deliver") => {
      if (!token || !order) return;
      setOtpFeedback(null);
      if (action === "deliver" && order.otp_required && !otp.trim()) {
        const message = "Ingresa el codigo de entrega que ve el cliente.";
        setOtpFeedback(message);
        showError("Falta el codigo", message);
        return;
      }
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
      }
    },
    [order, otp, setOrder, showError, token]
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

  return (
    <Screen refreshing={loading} onRefresh={() => void reload()}>
      <SectionHeader size="large" title={`Entrega #${order.id}`} description={`${order.store_name} - ${order.address_full ?? "Sin destino"}`} />
      {liveError ? <Text style={styles.warning}>{liveError}</Text> : null}
      <Card style={styles.card}>
        <Text style={styles.status}>{labelForStatus(order.status)}</Text>
        <Text style={styles.meta}>Envio: {labelForStatus(order.delivery_status)}</Text>
        <Text style={styles.meta}>Cobro: {formatCurrency(order.total)} - Comision {formatCurrency(order.rider_fee)}</Text>
        <Text style={styles.meta}>Cliente: {order.customer_name}</Text>
        <Text style={styles.meta}>ETA: {directions?.duration_minutes ?? order.eta_minutes ?? "-"} min</Text>
        <Text style={styles.trackingStatus}>{autoTrackingLabel(autoTrackingStatus)}</Text>
        {routeError ? <Text style={styles.warning}>{routeError}</Text> : null}
      </Card>

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
      />

      <Card style={styles.card}>
        <Text style={styles.subTitle}>Acciones</Text>
        <View style={styles.actions}>
          <AppButton title="Aceptar" icon="checkmark-circle-outline" onPress={() => void updateOrder("accept")} variant="ghost" />
          <AppButton title="Retirado" icon="bag-check-outline" onPress={() => void updateOrder("pickup")} variant="ghost" />
          <AppButton title="Mapa completo" icon="map-outline" onPress={() => navigation.navigate("DeliveryRouteMap", { orderId: order.id })} />
        </View>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.subTitle}>Entrega</Text>
        {order.otp_required ? (
          <>
            <TextField
              label="Codigo de entrega"
              value={otp}
              onChangeText={(value) => {
                setOtp(value);
                setOtpFeedback(null);
              }}
              keyboardType="number-pad"
            />
            {otpFeedback ? <Text style={styles.otpError}>{otpFeedback}</Text> : null}
          </>
        ) : (
          <Text style={styles.meta}>Este pedido no requiere codigo.</Text>
        )}
        <AppButton title="Marcar entregado" icon="checkmark-done-outline" onPress={() => void updateOrder("deliver")} fullWidth />
      </Card>

      <Card style={styles.card}>
        <Text style={styles.subTitle}>Productos</Text>
        {order.items.map((item) => (
          <View key={item.id} style={styles.line}>
            <Text style={styles.lineText}>
              {item.quantity}x {item.product_name}
            </Text>
            <Text style={styles.lineTotal}>{formatCurrency(item.unit_price * item.quantity)}</Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  warning: {
    color: colors.warning,
    fontWeight: "700",
    marginBottom: spacing.md
  },
  trackingStatus: {
    color: colors.success,
    backgroundColor: colors.successSoft,
    borderRadius: 12,
    padding: spacing.md,
    fontWeight: "900",
    lineHeight: 18
  },
  status: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "900"
  },
  meta: {
    color: colors.mutedText,
    lineHeight: 20
  },
  subTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  otpError: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: 12,
    padding: spacing.md,
    fontWeight: "800",
    lineHeight: 18
  },
  line: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md
  },
  lineText: {
    flex: 1,
    color: colors.text
  },
  lineTotal: {
    color: colors.text,
    fontWeight: "800"
  }
});
