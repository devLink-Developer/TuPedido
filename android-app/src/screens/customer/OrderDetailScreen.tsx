import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppButton } from "../../components/AppButton";
import { Card } from "../../components/Card";
import { MapPreview } from "../../components/MapPreview";
import { Screen } from "../../components/Screen";
import { SectionHeader } from "../../components/SectionHeader";
import { StateMessage } from "../../components/StateMessage";
import { useAsyncLoad } from "../../hooks/useAsyncLoad";
import { useOrderRealtime } from "../../hooks/useOrderRealtime";
import { fetchDirections, fetchOrder, fetchOrderPayment, fetchOrderTracking } from "../../services/api";
import { useAppFeedback } from "../../state/AppFeedbackContext";
import { useAuth } from "../../state/AuthContext";
import { useOrderReviewPrompt } from "../../state/OrderReviewPromptContext";
import { colors, spacing } from "../../theme";
import type { DirectionsRead, Order, OrderTracking, RouteCoordinate, RouteProfile } from "../../types/api";
import type { RootStackParamList } from "../../navigation/types";
import { friendlyErrorMessage } from "../../utils/apiMessages";
import { formatCurrency, formatDateTime } from "../../utils/format";
import { labelForStatus, paymentMethodLabels } from "../../utils/labels";

type Props = NativeStackScreenProps<RootStackParamList, "OrderDetail">;
const REVIEW_PROMPT_DELAY_MS = 10 * 60 * 1000;

function toRouteCoordinate(latitude: number | null | undefined, longitude: number | null | undefined): RouteCoordinate | null {
  if (typeof latitude !== "number" || typeof longitude !== "number") return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function routeProfileForVehicle(vehicle: string | null | undefined): RouteProfile {
  if (vehicle === "bicycle") return "cycling-regular";
  return "driving-car";
}

export function OrderDetailScreen({ route, navigation }: Props) {
  const { orderId } = route.params;
  const { token } = useAuth();
  const { showDialog, showError } = useAppFeedback();
  const { openReviewPrompt } = useOrderReviewPrompt();
  const [tracking, setTracking] = useState<OrderTracking | null>(null);
  const [directions, setDirections] = useState<DirectionsRead | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const { data: order, setData: setOrder, loading, error, reload } = useAsyncLoad<Order>(
    async () => {
      if (!token) throw new Error("Sesión no disponible");
      const [nextOrder, nextTracking] = await Promise.all([
        fetchOrder(token, orderId),
        fetchOrderTracking(token, orderId).catch(() => null)
      ]);
      setTracking(nextTracking);
      return nextOrder;
    },
    [orderId, token]
  );

  const pollCurrentOrder = useCallback(async () => {
    if (!token) return null;
    return fetchOrder(token, orderId);
  }, [orderId, token]);

  useOrderRealtime({
    token,
    orderId,
    enabled: Boolean(order && !["delivered", "cancelled", "delivery_failed"].includes(order.status)),
    onOrder: setOrder,
    onTracking: setTracking,
    onError: setLiveError,
    pollOrder: pollCurrentOrder
  });

  useEffect(() => {
    if (!token || !order || order.delivery_mode !== "delivery") {
      setDirections(null);
      return;
    }

    const destination = toRouteCoordinate(order.address_latitude, order.address_longitude);
    const rider = toRouteCoordinate(
      tracking?.tracking_last_latitude ?? order.tracking_last_latitude,
      tracking?.tracking_last_longitude ?? order.tracking_last_longitude
    );
    const store = toRouteCoordinate(order.store_latitude, order.store_longitude);
    const origin = rider ?? store;
    if (!origin || !destination) {
      setDirections(null);
      return;
    }

    let active = true;
    void fetchDirections(token, {
      profile: routeProfileForVehicle(tracking?.assigned_rider_vehicle_type ?? order.assigned_rider_vehicle_type),
      coordinates: [origin, destination]
    })
      .then((nextDirections) => {
        if (active) setDirections(nextDirections);
      })
      .catch(() => {
        if (active) setDirections(null);
      });

    return () => {
      active = false;
    };
  }, [
    order,
    token,
    tracking?.assigned_rider_vehicle_type,
    tracking?.tracking_last_latitude,
    tracking?.tracking_last_longitude
  ]);

  const refreshPayment = useCallback(async () => {
    if (!token) return;
    try {
      const payment = await fetchOrderPayment(token, orderId);
      showDialog({ title: "Pago", message: `Estado: ${payment.status}`, variant: "info" });
      await reload();
    } catch (paymentError) {
      showError("Pago no disponible", friendlyErrorMessage(paymentError));
    }
  }, [orderId, reload, showDialog, showError, token]);

  function openOrderReview() {
    if (!order) return;
    openReviewPrompt({
      order_id: order.id,
      store_name: order.store_name,
      delivered_at: order.delivered_at,
      rider_name: order.assigned_rider_name,
      requires_rider_rating: Boolean(order.assigned_rider_id)
    });
  }

  if (loading && !order) {
    return <StateMessage title="Cargando pedido" loading />;
  }
  if (error || !order) {
    return <StateMessage title="Pedido no disponible" description={error ?? undefined} actionLabel="Reintentar" onAction={() => void reload()} />;
  }

  const deliveryCodeRequired = Boolean(tracking?.otp_required ?? order.otp_required);
  const deliveryCode = tracking?.otp_code ?? null;

  return (
    <Screen refreshing={loading} onRefresh={() => void reload()}>
      <SectionHeader size="large" title={`Pedido #${order.id}`} description={`${order.store_name} - ${formatDateTime(order.created_at)}`} />
      {liveError ? <Text style={styles.liveError}>{liveError}</Text> : null}
      <Card style={styles.card}>
        <Text style={styles.status}>{labelForStatus(order.status)}</Text>
        <Text style={styles.meta}>
          Pago: {paymentMethodLabels[order.payment_method] ?? order.payment_method} - {labelForStatus(order.payment_status)}
        </Text>
        <Text style={styles.meta}>Entrega: {labelForStatus(order.delivery_status)}</Text>
        {order.payment_method === "mercadopago" ? <AppButton title="Actualizar pago" icon="refresh-outline" onPress={() => void refreshPayment()} variant="ghost" /> : null}
      </Card>

      {deliveryCodeRequired ? (
        <Card style={[styles.card, styles.deliveryCodeCard]}>
          <Text style={styles.deliveryCodeKicker}>Código de entrega</Text>
          <Text style={styles.deliveryCodeTitle}>Mostráselo al repartidor al recibir el pedido.</Text>
          {deliveryCode ? (
            <Text selectable maxFontSizeMultiplier={1.15} style={styles.deliveryCodeValue}>
              {deliveryCode}
            </Text>
          ) : (
            <Text style={styles.deliveryCodePending}>El código aparecerá cuando el seguimiento esté activo.</Text>
          )}
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
        points={[
          { id: "store", label: "Comercio", latitude: order.store_latitude, longitude: order.store_longitude, color: colors.primary },
          {
            id: "rider",
            label: "Repartidor",
            latitude: tracking?.tracking_last_latitude ?? order.tracking_last_latitude,
            longitude: tracking?.tracking_last_longitude ?? order.tracking_last_longitude,
            color: colors.accent
          },
          { id: "address", label: "Destino", latitude: order.address_latitude, longitude: order.address_longitude, color: colors.success }
        ]}
        pointMeta={{
          store: order.store_name,
          rider: tracking?.assigned_rider_name ?? order.assigned_rider_name ?? "Repartidor asignado",
          address: order.address_full ?? order.address_label
        }}
      />

      <Card style={styles.card}>
        <Text style={styles.subTitle}>Seguimiento</Text>
        <Text style={styles.meta}>Repartidor: {tracking?.assigned_rider_name ?? order.assigned_rider_name ?? "Sin asignar"}</Text>
        <Text style={styles.meta}>Teléfono: {tracking?.assigned_rider_phone_masked ?? order.assigned_rider_phone_masked ?? "No disponible"}</Text>
        <Text style={styles.meta}>Tiempo estimado: {tracking?.eta_minutes ?? directions?.duration_minutes ?? order.eta_minutes ?? "-"} min</Text>
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
        <Text style={styles.total}>Total {formatCurrency(order.total)}</Text>
      </Card>

      {order.status === "delivered" ? (
        <Card style={styles.card}>
          <Text style={styles.subTitle}>Calificar experiencia</Text>
          <Text style={styles.meta}>
            La solicitud se habilita 10 minutos después de recibir el pedido para que puedas revisarlo con calma.
          </Text>
          <AppButton
            title="Calificar ahora"
            icon="star-outline"
            onPress={openOrderReview}
            disabled={!order.delivered_at || Date.now() - new Date(order.delivered_at).getTime() < REVIEW_PROMPT_DELAY_MS}
          />
        </Card>
      ) : null}

      <AppButton title="Volver a pedidos" icon="receipt-outline" onPress={() => navigation.navigate("CustomerTabs", { screen: "Orders" })} variant="ghost" fullWidth />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  liveError: {
    color: colors.warning,
    marginBottom: spacing.md,
    fontWeight: "700"
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
  deliveryCodeCard: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  deliveryCodeKicker: {
    color: colors.primaryDark,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.2
  },
  deliveryCodeTitle: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "800"
  },
  deliveryCodeValue: {
    color: colors.primaryDark,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: 6,
    fontWeight: "900",
    textAlign: "center"
  },
  deliveryCodePending: {
    color: colors.warning,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 12,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800"
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
  },
  total: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    marginTop: spacing.sm
  }
});
