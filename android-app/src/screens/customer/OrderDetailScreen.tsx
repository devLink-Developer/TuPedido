import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppButton } from "../../components/AppButton";
import { Card } from "../../components/Card";
import { MapPreview } from "../../components/MapPreview";
import { Screen } from "../../components/Screen";
import { SectionHeader } from "../../components/SectionHeader";
import { StateMessage } from "../../components/StateMessage";
import { TextField } from "../../components/TextField";
import { useAsyncLoad } from "../../hooks/useAsyncLoad";
import { useOrderRealtime } from "../../hooks/useOrderRealtime";
import { createOrderReview, fetchDirections, fetchOrder, fetchOrderPayment, fetchOrderTracking } from "../../services/api";
import { useAppFeedback } from "../../state/AppFeedbackContext";
import { useAuth } from "../../state/AuthContext";
import { colors, spacing } from "../../theme";
import type { DirectionsRead, Order, OrderTracking, RouteCoordinate, RouteProfile } from "../../types/api";
import type { RootStackParamList } from "../../navigation/types";
import { friendlyErrorMessage } from "../../utils/apiMessages";
import { formatCurrency, formatDateTime } from "../../utils/format";
import { labelForStatus, paymentMethodLabels } from "../../utils/labels";

type Props = NativeStackScreenProps<RootStackParamList, "OrderDetail">;

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
  const { showDialog, showError, showSuccess } = useAppFeedback();
  const [tracking, setTracking] = useState<OrderTracking | null>(null);
  const [directions, setDirections] = useState<DirectionsRead | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [reviewText, setReviewText] = useState("");
  const [storeRating, setStoreRating] = useState("5");
  const [riderRating, setRiderRating] = useState("5");
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

  async function submitReview() {
    if (!token || !order) return;
    try {
      await createOrderReview(token, order.id, {
        store_rating: Number(storeRating) || 5,
        rider_rating: Number(riderRating) || null,
        review_text: reviewText.trim() || null
      });
      showSuccess("Gracias", "Tu calificación fue guardada.");
      await reload();
    } catch (reviewError) {
      showError("No se pudo guardar", friendlyErrorMessage(reviewError));
    }
  }

  if (loading && !order) {
    return <StateMessage title="Cargando pedido" loading />;
  }
  if (error || !order) {
    return <StateMessage title="Pedido no disponible" description={error ?? undefined} actionLabel="Reintentar" onAction={() => void reload()} />;
  }

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
      />

      <Card style={styles.card}>
        <Text style={styles.subTitle}>Seguimiento</Text>
        <Text style={styles.meta}>Repartidor: {tracking?.assigned_rider_name ?? order.assigned_rider_name ?? "Sin asignar"}</Text>
        <Text style={styles.meta}>Teléfono: {tracking?.assigned_rider_phone_masked ?? order.assigned_rider_phone_masked ?? "No disponible"}</Text>
        <Text style={styles.meta}>Tiempo estimado: {tracking?.eta_minutes ?? directions?.duration_minutes ?? order.eta_minutes ?? "-"} min</Text>
        {tracking?.otp_required && tracking.otp_code ? <Text style={styles.otp}>Código OTP: {tracking.otp_code}</Text> : null}
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
          <Text style={styles.subTitle}>Calificar pedido</Text>
          <View style={styles.ratingRow}>
            <TextField label="Comercio" value={storeRating} onChangeText={setStoreRating} keyboardType="number-pad" />
            <TextField label="Repartidor" value={riderRating} onChangeText={setRiderRating} keyboardType="number-pad" />
          </View>
          <TextField label="Comentario" value={reviewText} onChangeText={setReviewText} multiline />
          <AppButton title="Enviar calificación" icon="star-outline" onPress={() => void submitReview()} />
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
  otp: {
    color: colors.primaryDark,
    backgroundColor: colors.primarySoft,
    padding: spacing.md,
    borderRadius: 12,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center"
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
  },
  ratingRow: {
    flexDirection: "row",
    gap: spacing.md
  }
});
