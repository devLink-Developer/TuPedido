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
import { acceptDeliveryOrder, deliverDeliveryOrder, fetchDeliveryOrders, fetchDirections, pickupDeliveryOrder } from "../../services/api";
import { useAsyncLoad } from "../../hooks/useAsyncLoad";
import { useOrderRealtime } from "../../hooks/useOrderRealtime";
import { useAppFeedback } from "../../state/AppFeedbackContext";
import { useAuth } from "../../state/AuthContext";
import { colors, spacing } from "../../theme";
import type { DirectionsRead, Order, OrderTracking, RouteCoordinate, RouteProfile } from "../../types/api";
import type { RootStackParamList } from "../../navigation/types";
import { friendlyErrorMessage } from "../../utils/apiMessages";
import { formatCurrency } from "../../utils/format";
import { labelForStatus } from "../../utils/labels";
import { requestDeliveryLocationPermissions, startDeliveryLocationTracking, stopDeliveryLocationTracking } from "../../tracking/backgroundLocation";

type Props = NativeStackScreenProps<RootStackParamList, "DeliveryOrderDetail">;

function toRouteCoordinate(latitude: number | null | undefined, longitude: number | null | undefined): RouteCoordinate | null {
  if (typeof latitude !== "number" || typeof longitude !== "number") return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function routeProfileForVehicle(vehicle: string | null | undefined): RouteProfile {
  if (vehicle === "bicycle") return "cycling-regular";
  return "driving-car";
}

export function DeliveryOrderDetailScreen({ route }: Props) {
  const { orderId } = route.params;
  const { token } = useAuth();
  const { showDialog, showError, showSuccess } = useAppFeedback();
  const [tracking, setTracking] = useState<OrderTracking | null>(null);
  const [directions, setDirections] = useState<DirectionsRead | null>(null);
  const [otp, setOtp] = useState("");
  const [liveError, setLiveError] = useState<string | null>(null);
  const { data: order, setData: setOrder, loading, error, reload } = useAsyncLoad<Order>(
    async () => {
      if (!token) throw new Error("Sesión no disponible");
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

  const updateOrder = useCallback(
    async (action: "accept" | "pickup" | "deliver") => {
      if (!token || !order) return;
      try {
        const nextOrder =
          action === "accept"
            ? await acceptDeliveryOrder(token, order.id)
            : action === "pickup"
              ? await pickupDeliveryOrder(token, order.id)
              : await deliverDeliveryOrder(token, order.id, otp.trim() || null);
        setOrder(nextOrder);
        if (action === "deliver") await stopDeliveryLocationTracking();
      } catch (actionError) {
        showError("Acción no disponible", friendlyErrorMessage(actionError));
      }
    },
    [order, otp, setOrder, showError, token]
  );

  async function startTracking() {
    if (!order) return;
    const permission = await requestDeliveryLocationPermissions();
    if (!permission.granted) {
      showDialog({
        title: "Permiso requerido",
        message: permission.message ?? "Habilitá la ubicación para compartir tu recorrido mientras entregás el pedido.",
        variant: "warning"
      });
      return;
    }
    try {
      await startDeliveryLocationTracking(order.id);
      showSuccess("Seguimiento activo", "La app va a compartir tu ubicación mientras este pedido siga en curso.");
    } catch (trackingError) {
      showError("No se pudo iniciar el seguimiento", friendlyErrorMessage(trackingError));
    }
  }

  if (loading && !order) return <StateMessage title="Cargando entrega" loading />;
  if (error || !order) return <StateMessage title="Entrega no disponible" description={error ?? undefined} actionLabel="Reintentar" onAction={() => void reload()} />;

  return (
    <Screen refreshing={loading} onRefresh={() => void reload()}>
      <SectionHeader size="large" title={`Entrega #${order.id}`} description={`${order.store_name} - ${order.address_full ?? "Sin destino"}`} />
      {liveError ? <Text style={styles.warning}>{liveError}</Text> : null}
      <Card style={styles.card}>
        <Text style={styles.status}>{labelForStatus(order.status)}</Text>
        <Text style={styles.meta}>Envío: {labelForStatus(order.delivery_status)}</Text>
        <Text style={styles.meta}>Cobro: {formatCurrency(order.total)} · Comisión {formatCurrency(order.rider_fee)}</Text>
        <Text style={styles.meta}>Cliente: {order.customer_name}</Text>
        <Text style={styles.meta}>ETA: {directions?.duration_minutes ?? order.eta_minutes ?? "-"} min</Text>
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
        <Text style={styles.subTitle}>Acciones</Text>
        <View style={styles.actions}>
          <AppButton title="Aceptar" icon="checkmark-circle-outline" onPress={() => void updateOrder("accept")} variant="ghost" />
          <AppButton title="Retirado" icon="bag-check-outline" onPress={() => void updateOrder("pickup")} variant="ghost" />
          <AppButton title="Iniciar seguimiento" icon="location-outline" onPress={() => void startTracking()} />
          <AppButton title="Detener seguimiento" icon="stop-circle-outline" onPress={() => void stopDeliveryLocationTracking()} variant="danger" />
        </View>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.subTitle}>Entrega</Text>
        {order.otp_required ? <TextField label="Código OTP" value={otp} onChangeText={setOtp} keyboardType="number-pad" /> : <Text style={styles.meta}>Este pedido no requiere OTP.</Text>}
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
