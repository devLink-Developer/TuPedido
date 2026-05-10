import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppButton } from "../../components/AppButton";
import { Card } from "../../components/Card";
import { IconButton } from "../../components/IconButton";
import { Screen } from "../../components/Screen";
import { SectionHeader } from "../../components/SectionHeader";
import { StateMessage } from "../../components/StateMessage";
import { fetchDeliveryMe, fetchDeliveryOrders, updateDeliveryAvailability } from "../../services/api";
import { useAuth } from "../../state/AuthContext";
import { useAppFeedback } from "../../state/AppFeedbackContext";
import { useNotificationsState } from "../../state/NotificationsContext";
import { colors, radii, spacing } from "../../theme";
import type { DeliveryAvailability, DeliveryProfile, Order } from "../../types/api";
import type { DeliveryTabsParamList, RootStackParamList } from "../../navigation/types";
import { formatCurrency } from "../../utils/format";
import { friendlyErrorMessage } from "../../utils/apiMessages";
import { labelForStatus } from "../../utils/labels";
import { getTrackedOrderId, requestDeliveryLocationPermissions, startDeliveryLocationTracking, stopDeliveryLocationTracking } from "../../tracking/backgroundLocation";

type Props = BottomTabScreenProps<DeliveryTabsParamList, "DeliveryHome">;
type RootNav = NativeStackNavigationProp<RootStackParamList>;

const availabilityOptions: DeliveryAvailability[] = ["offline", "idle", "paused"];

export function DeliveryHomeScreen(_props: Props) {
  const navigation = useNavigation<RootNav>();
  const { token } = useAuth();
  const { showDialog, showError, showSuccess } = useAppFeedback();
  const { unreadCount } = useNotificationsState();
  const [profile, setProfile] = useState<DeliveryProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [trackedOrderId, setTrackedOrderId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [nextProfile, nextOrders, activeTrackedOrderId] = await Promise.all([
        fetchDeliveryMe(token),
        fetchDeliveryOrders(token),
        getTrackedOrderId()
      ]);
      setProfile(nextProfile);
      setOrders(nextOrders);
      setTrackedOrderId(activeTrackedOrderId);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useEffect(() => {
    const timer = setInterval(() => void load(), 30000);
    return () => clearInterval(timer);
  }, [load]);

  const activeOrder = useMemo(
    () => orders.find((order) => !["delivered", "cancelled", "delivery_failed"].includes(order.status)) ?? null,
    [orders]
  );

  async function setAvailability(availability: DeliveryAvailability) {
    if (!token) return;
    try {
      setProfile(await updateDeliveryAvailability(token, { availability, zone_id: profile?.current_zone_id ?? null }));
    } catch (error) {
      showError("No se pudo cambiar disponibilidad", friendlyErrorMessage(error));
    }
  }

  async function startTracking(orderId: number) {
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
      await startDeliveryLocationTracking(orderId);
      setTrackedOrderId(orderId);
      showSuccess("Seguimiento activo", "La app va a compartir tu ubicación mientras este pedido siga en curso.");
    } catch (error) {
      showError("No se pudo iniciar el seguimiento", friendlyErrorMessage(error));
    }
  }

  async function stopTracking() {
    await stopDeliveryLocationTracking();
    setTrackedOrderId(null);
  }

  return (
    <Screen refreshing={loading} onRefresh={() => void load()}>
      <View style={styles.topRow}>
        <View style={styles.topCopy}>
          <SectionHeader size="large" title="Repartidor" description={profile ? `${profile.full_name} - ${labelForStatus(profile.availability)}` : "Cargando perfil"} />
        </View>
        <IconButton icon="notifications-outline" label="Abrir notificaciones" badge={unreadCount} onPress={() => navigation.navigate("Notifications")} />
      </View>

      {profile ? (
        <Card style={styles.card}>
          <Text style={styles.big}>{labelForStatus(profile.availability)}</Text>
          <Text style={styles.meta}>Zona actual: {profile.current_zone_id ?? "Sin zona"}</Text>
          <Text style={styles.meta}>Entregas: {profile.completed_deliveries} - Rating: {profile.rating ?? "-"}</Text>
          <View style={styles.options}>
            {availabilityOptions.map((availability) => (
              <Pressable
                key={availability}
                accessibilityRole="button"
                accessibilityState={{ selected: profile.availability === availability }}
                onPress={() => void setAvailability(availability)}
                style={[styles.option, profile.availability === availability && styles.optionActive]}
              >
                <Text style={[styles.optionText, profile.availability === availability && styles.optionTextActive]}>{labelForStatus(availability)}</Text>
              </Pressable>
            ))}
          </View>
        </Card>
      ) : (
        <StateMessage title="Perfil no disponible" loading={loading} />
      )}

      <SectionHeader title="Pedido activo" description="Compartí ubicación solo cuando estés realizando una entrega." />
      {activeOrder ? (
        <Card style={styles.card}>
          <Text style={styles.big}>Pedido #{activeOrder.id}</Text>
          <Text style={styles.meta}>{activeOrder.store_name} - {activeOrder.address_full ?? "Sin dirección"}</Text>
          <Text style={styles.meta}>Estado: {labelForStatus(activeOrder.status)} - Total {formatCurrency(activeOrder.total)}</Text>
          <View style={styles.actions}>
            <AppButton title="Ver entrega" icon="navigate-outline" onPress={() => navigation.navigate("DeliveryOrderDetail", { orderId: activeOrder.id })} />
            {trackedOrderId === activeOrder.id ? (
              <AppButton title="Detener seguimiento" icon="stop-circle-outline" onPress={() => void stopTracking()} variant="danger" />
            ) : (
              <AppButton title="Iniciar seguimiento" icon="location-outline" onPress={() => void startTracking(activeOrder.id)} variant="ghost" />
            )}
          </View>
        </Card>
      ) : (
        <StateMessage title="Sin entrega activa" description="Los pedidos asignados aparecerán en la pestaña Pedidos." />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md
  },
  topCopy: {
    flex: 1,
    minWidth: 0
  },
  card: {
    gap: spacing.md,
    marginBottom: spacing.md
  },
  big: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "900"
  },
  meta: {
    color: colors.mutedText,
    lineHeight: 20
  },
  options: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  option: {
    minHeight: 44,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    justifyContent: "center"
  },
  optionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  optionText: {
    color: colors.text,
    fontWeight: "800"
  },
  optionTextActive: {
    color: "#FFFFFF"
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  }
});
