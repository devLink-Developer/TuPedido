import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppButton } from "../../components/AppButton";
import { Card } from "../../components/Card";
import { IconButton } from "../../components/IconButton";
import { Screen } from "../../components/Screen";
import { StateMessage } from "../../components/StateMessage";
import { fetchDeliveryMe, fetchDeliveryOrders, updateDeliveryAvailability } from "../../services/api";
import { useAutoDeliveryLocationTracking } from "../../hooks/useAutoDeliveryLocationTracking";
import { useAuth } from "../../state/AuthContext";
import { useAppFeedback } from "../../state/AppFeedbackContext";
import { useNotificationsState } from "../../state/NotificationsContext";
import { colors, radii, spacing } from "../../theme";
import type { DeliveryAvailability, DeliveryProfile, Order } from "../../types/api";
import type { DeliveryTabsParamList, RootStackParamList } from "../../navigation/types";
import { formatCurrency } from "../../utils/format";
import { friendlyErrorMessage } from "../../utils/apiMessages";
import { labelForStatus } from "../../utils/labels";
import { getRiderCustomerName, getRiderDeliveryAddress } from "../../utils/deliveryOrderDisplay";

type Props = BottomTabScreenProps<DeliveryTabsParamList, "DeliveryHome">;
type RootNav = NativeStackNavigationProp<RootStackParamList>;

const availabilityOptions: DeliveryAvailability[] = ["offline", "idle", "paused"];

export function DeliveryHomeScreen(_props: Props) {
  const navigation = useNavigation<RootNav>();
  const { token } = useAuth();
  const { showDialog, showError } = useAppFeedback();
  const { unreadCount } = useNotificationsState();
  const [profile, setProfile] = useState<DeliveryProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [nextProfile, nextOrders] = await Promise.all([
        fetchDeliveryMe(token),
        fetchDeliveryOrders(token)
      ]);
      setProfile(nextProfile);
      setOrders(nextOrders);
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
  const activeDestination = activeOrder ? getRiderDeliveryAddress(activeOrder) : "Sin direccion";

  const { status: autoTrackingStatus } = useAutoDeliveryLocationTracking({
    token,
    order: activeOrder,
    onPermissionBlocked: (message) =>
      showDialog({
        title: "Ubicacion requerida",
        message: message ?? "Habilita la ubicacion para compartir el recorrido del pedido activo.",
        variant: "warning"
      }),
    onError: (message) => showError("Seguimiento automatico", message)
  });

  async function setAvailability(availability: DeliveryAvailability) {
    if (!token) return;
    try {
      setProfile(await updateDeliveryAvailability(token, { availability, zone_id: profile?.current_zone_id ?? null }));
    } catch (error) {
      showError("No se pudo cambiar disponibilidad", friendlyErrorMessage(error));
    }
  }

  function trackingStatusCopy() {
    if (autoTrackingStatus === "active") return "Ubicacion compartida con el cliente.";
    if (autoTrackingStatus === "starting") return "Activando seguimiento de ubicacion.";
    if (autoTrackingStatus === "blocked") return "Falta permiso de ubicacion.";
    if (autoTrackingStatus === "error") return "Seguimiento automatico no disponible.";
    return "Se activa al aceptar una entrega.";
  }

  return (
    <Screen refreshing={loading} onRefresh={() => void load()} contentContainerStyle={styles.screenContent}>
      <View style={styles.topRow}>
        <View style={styles.topCopy}>
          <Text maxFontSizeMultiplier={1.15} style={styles.screenTitle}>Repartidor</Text>
          <Text maxFontSizeMultiplier={1.2} style={styles.screenSubtitle}>
            {profile ? `${profile.full_name} - ${labelForStatus(profile.availability)}` : "Cargando perfil"}
          </Text>
        </View>
        <IconButton icon="notifications-outline" label="Abrir notificaciones" badge={unreadCount} onPress={() => navigation.navigate("Notifications")} />
      </View>

      {profile ? (
        <Card style={styles.availabilityCard}>
          <View style={styles.cardHeader}>
            <View style={styles.headerCopy}>
              <Text maxFontSizeMultiplier={1.1} style={styles.label}>Estado</Text>
              <Text maxFontSizeMultiplier={1.15} style={styles.cardTitle}>{labelForStatus(profile.availability)}</Text>
            </View>
            <Text maxFontSizeMultiplier={1.1} style={styles.zoneChip}>Zona {profile.current_zone_id ?? "-"}</Text>
          </View>
          <View style={styles.metricRow}>
            <View style={styles.metricBox}>
              <Text maxFontSizeMultiplier={1.1} style={styles.metricValue}>{profile.completed_deliveries}</Text>
              <Text maxFontSizeMultiplier={1.1} style={styles.metricLabel}>Entregas</Text>
            </View>
            <View style={styles.metricBox}>
              <Text maxFontSizeMultiplier={1.1} style={styles.metricValue}>{profile.rating ?? "-"}</Text>
              <Text maxFontSizeMultiplier={1.1} style={styles.metricLabel}>Rating</Text>
            </View>
          </View>
          <View style={styles.options}>
            {availabilityOptions.map((availability) => (
              <Pressable
                key={availability}
                accessibilityRole="button"
                accessibilityState={{ selected: profile.availability === availability }}
                android_ripple={{ color: colors.borderStrong, borderless: false }}
                onPress={() => void setAvailability(availability)}
                style={[styles.option, profile.availability === availability && styles.optionActive]}
              >
                <Text maxFontSizeMultiplier={1.1} style={[styles.optionText, profile.availability === availability && styles.optionTextActive]}>{labelForStatus(availability)}</Text>
              </Pressable>
            ))}
          </View>
        </Card>
      ) : (
        <StateMessage title="Perfil no disponible" loading={loading} />
      )}

      <View style={styles.sectionHeading}>
        <Text maxFontSizeMultiplier={1.15} style={styles.sectionTitle}>Pedido activo</Text>
        <Text maxFontSizeMultiplier={1.2} style={styles.sectionHint}>Accesos rapidos para navegar y cerrar entrega.</Text>
      </View>

      {activeOrder ? (
        <Card style={styles.activeCard}>
          <View style={styles.orderHeader}>
            <View style={styles.headerCopy}>
              <Text maxFontSizeMultiplier={1.1} style={styles.label}>Pedido #{activeOrder.id}</Text>
              <Text maxFontSizeMultiplier={1.2} style={styles.cardTitle} numberOfLines={2}>{activeDestination}</Text>
            </View>
            <Text maxFontSizeMultiplier={1.1} style={styles.statusChip}>{labelForStatus(activeOrder.delivery_status)}</Text>
          </View>
          <Text maxFontSizeMultiplier={1.15} style={styles.storeText} numberOfLines={1}>{activeOrder.store_name}</Text>
          <Text maxFontSizeMultiplier={1.15} style={styles.customerText} numberOfLines={1}>
            Cliente: {getRiderCustomerName(activeOrder)}
          </Text>
          <View style={styles.summaryRow}>
            <Text maxFontSizeMultiplier={1.1} style={styles.summaryPill}>{formatCurrency(activeOrder.total)}</Text>
            <Text maxFontSizeMultiplier={1.1} style={styles.summaryPill}>{labelForStatus(activeOrder.status)}</Text>
          </View>
          <View style={styles.trackingStatus}>
            <Ionicons
              name={autoTrackingStatus === "active" ? "radio-button-on" : "radio-button-off"}
              size={18}
              color={autoTrackingStatus === "active" ? colors.success : colors.warning}
            />
            <Text maxFontSizeMultiplier={1.15} style={styles.trackingText}>{trackingStatusCopy()}</Text>
          </View>
          <View style={styles.actions}>
            <AppButton title="Mapa" icon="map-outline" onPress={() => navigation.navigate("DeliveryRouteMap", { orderId: activeOrder.id })} style={styles.actionButton} />
            <AppButton title="Detalle" icon="document-text-outline" onPress={() => navigation.navigate("DeliveryOrderDetail", { orderId: activeOrder.id })} variant="ghost" style={styles.actionButton} />
          </View>
        </Card>
      ) : (
        <StateMessage title="Sin entrega activa" description="Los pedidos asignados apareceran en la pestana Pedidos." />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    gap: spacing.md
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  topCopy: {
    flex: 1,
    minWidth: 0
  },
  screenTitle: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900"
  },
  screenSubtitle: {
    color: colors.mutedText,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
    marginTop: 2
  },
  availabilityCard: {
    gap: spacing.sm
  },
  activeCard: {
    gap: spacing.sm
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm
  },
  orderHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm
  },
  headerCopy: {
    flex: 1,
    minWidth: 0
  },
  label: {
    color: colors.primaryDark,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  cardTitle: {
    color: colors.text,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "900",
    marginTop: 2
  },
  zoneChip: {
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
  statusChip: {
    overflow: "hidden",
    borderRadius: radii.pill,
    backgroundColor: colors.warningSoft,
    color: colors.warning,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900"
  },
  metricRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  metricBox: {
    flex: 1,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  metricValue: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "900"
  },
  metricLabel: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    marginTop: 2
  },
  options: {
    flexDirection: "row",
    gap: spacing.sm
  },
  option: {
    flex: 1,
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm
  },
  optionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  optionText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800",
    textAlign: "center"
  },
  optionTextActive: {
    color: "#FFFFFF"
  },
  sectionHeading: {
    gap: 2
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 21,
    lineHeight: 26,
    fontWeight: "900"
  },
  sectionHint: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700"
  },
  storeText: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800"
  },
  customerText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "900"
  },
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  summaryPill: {
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
  trackingStatus: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.successSoft,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  trackingText: {
    flex: 1,
    color: colors.success,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "900"
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm
  },
  actionButton: {
    flex: 1
  }
});
