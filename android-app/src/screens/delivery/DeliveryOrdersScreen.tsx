import { Ionicons } from "@expo/vector-icons";
import { useCallback, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppButton } from "../../components/AppButton";
import { Card } from "../../components/Card";
import { Screen } from "../../components/Screen";
import { SectionHeader } from "../../components/SectionHeader";
import { StateMessage } from "../../components/StateMessage";
import { useAutoDeliveryLocationTracking } from "../../hooks/useAutoDeliveryLocationTracking";
import { acceptDeliveryOrder, fetchDeliveryOrders, pickupDeliveryOrder } from "../../services/api";
import { useAppFeedback } from "../../state/AppFeedbackContext";
import { useAuth } from "../../state/AuthContext";
import { colors, opacity, radii, shadow, spacing } from "../../theme";
import type { Order } from "../../types/api";
import type { DeliveryTabsParamList, RootStackParamList } from "../../navigation/types";
import { friendlyErrorMessage } from "../../utils/apiMessages";
import { formatCurrency, formatDateTime } from "../../utils/format";
import { labelForStatus } from "../../utils/labels";
import { getRiderCustomerName, getRiderDeliveryAddress } from "../../utils/deliveryOrderDisplay";

type Props = BottomTabScreenProps<DeliveryTabsParamList, "DeliveryOrders">;
type RootNav = NativeStackNavigationProp<RootStackParamList>;
type DeliveryAction = "accept" | "pickup";

const ACTIVE_DELIVERY_STATUSES = new Set(["assigned", "heading_to_store", "picked_up", "near_customer"]);
const TERMINAL_STATUSES = new Set(["delivered", "cancelled", "delivery_failed"]);

function needsPickup(order: Order) {
  return ["accepted", "preparing", "ready_for_dispatch"].includes(order.status);
}

function isAssigned(order: Order) {
  return order.delivery_status === "assigned" || order.status === "created";
}

function primaryActionForOrder(order: Order): DeliveryAction | null {
  if (isAssigned(order)) return "accept";
  if (needsPickup(order)) return "pickup";
  return null;
}

function nextStepForOrder(order: Order) {
  if (isAssigned(order)) return "Aceptar pedido";
  if (needsPickup(order)) return "Retirar en comercio";
  if (order.delivery_status === "picked_up" || order.delivery_status === "near_customer") return "Entregar al cliente";
  if (order.status === "delivered") return "Entregado";
  return labelForStatus(order.delivery_status);
}

function orderTime(order: Order) {
  return order.updated_at ?? order.created_at;
}

export function DeliveryOrdersScreen(_props: Props) {
  const navigation = useNavigation<RootNav>();
  const { token } = useAuth();
  const { showDialog, showError } = useAppFeedback();
  const [orders, setOrders] = useState<Order[]>([]);
  const [savingOrderId, setSavingOrderId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setOrders(await fetchDeliveryOrders(token));
    } catch (loadError) {
      setError(friendlyErrorMessage(loadError, "No se pudieron cargar pedidos"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const activeOrder = useMemo(
    () => orders.find((order) => ACTIVE_DELIVERY_STATUSES.has(order.delivery_status) && !TERMINAL_STATUSES.has(order.status)) ?? null,
    [orders]
  );

  const stats = useMemo(() => {
    const active = orders.filter((order) => ACTIVE_DELIVERY_STATUSES.has(order.delivery_status) && !TERMINAL_STATUSES.has(order.status));
    const pickupReady = orders.filter(needsPickup);
    const withCode = orders.filter((order) => order.otp_required && !TERMINAL_STATUSES.has(order.status));
    const estimated = orders.reduce((total, order) => total + (TERMINAL_STATUSES.has(order.status) ? 0 : order.rider_fee ?? 0), 0);
    return {
      active: active.length,
      pickupReady: pickupReady.length,
      withCode: withCode.length,
      estimated
    };
  }, [orders]);

  useAutoDeliveryLocationTracking({
    token,
    order: activeOrder,
    onPermissionBlocked: (message) =>
      showDialog({
        title: "Ubicación requerida",
        message: message ?? "Habilitá la ubicación para compartir el recorrido del pedido activo.",
        variant: "warning"
      }),
    onError: (message) => showError("Ubicación", message)
  });

  async function runAction(action: DeliveryAction, orderId: number) {
    if (!token || savingOrderId) return;
    setSavingOrderId(orderId);
    try {
      const updated = action === "accept" ? await acceptDeliveryOrder(token, orderId) : await pickupDeliveryOrder(token, orderId);
      setOrders((current) => current.map((order) => (order.id === updated.id ? updated : order)));
    } catch (actionError) {
      showError("Acción no disponible", friendlyErrorMessage(actionError));
    } finally {
      setSavingOrderId(null);
    }
  }

  return (
    <Screen noScroll>
      <FlatList
        data={orders}
        keyExtractor={(item) => String(item.id)}
        refreshing={loading}
        onRefresh={() => void load()}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <SectionHeader size="large" title="Pedidos" description={error ?? "Tus entregas asignadas y próximos pasos."} />
            <View style={styles.summaryGrid}>
              <MetricCard icon="navigate-circle-outline" label="En curso" value={String(stats.active)} tone="primary" />
              <MetricCard icon="bag-check-outline" label="Para retirar" value={String(stats.pickupReady)} tone="warning" />
              <MetricCard icon="keypad-outline" label="Con código" value={String(stats.withCode)} tone="neutral" />
              <MetricCard icon="cash-outline" label="Estimado" value={formatCurrency(stats.estimated)} tone="success" />
            </View>
            {activeOrder ? (
              <Card style={styles.activeCard}>
                <View style={styles.activeHeader}>
                  <View style={styles.activeIcon}>
                    <Ionicons name="navigate-outline" size={22} color="#FFFFFF" />
                  </View>
                  <View style={styles.activeCopy}>
                    <Text style={styles.activeLabel}>Entrega activa</Text>
                    <Text style={styles.activeTitle} numberOfLines={1}>{activeOrder.store_name}</Text>
                    <Text style={styles.activeMeta} numberOfLines={1}>Cliente: {getRiderCustomerName(activeOrder)}</Text>
                    <Text style={styles.activeMeta} numberOfLines={1}>{getRiderDeliveryAddress(activeOrder)}</Text>
                  </View>
                </View>
                <View style={styles.activeActions}>
                  <AppButton title="Abrir mapa" icon="map-outline" onPress={() => navigation.navigate("DeliveryRouteMap", { orderId: activeOrder.id })} fullWidth />
                  <AppButton title="Ver pedido" icon="receipt-outline" onPress={() => navigation.navigate("DeliveryOrderDetail", { orderId: activeOrder.id })} variant="ghost" fullWidth />
                </View>
              </Card>
            ) : null}
          </View>
        }
        ListEmptyComponent={!loading ? <StateMessage title="Sin pedidos" description="Cuando tengas entregas asignadas aparecerán acá." /> : null}
        renderItem={({ item }) => {
          const primaryAction = primaryActionForOrder(item);
          const saving = savingOrderId === item.id;
          return (
            <Card style={styles.order}>
              <View style={styles.orderTop}>
                <View style={styles.orderTitleWrap}>
                  <Text style={styles.orderEyebrow}>Pedido #{item.id}</Text>
                  <Text style={styles.orderTitle} numberOfLines={1}>{item.store_name}</Text>
                </View>
                <View style={styles.statusPill}>
                  <Text style={styles.statusText}>{labelForStatus(item.delivery_status)}</Text>
                </View>
              </View>

              <View style={styles.detailGrid}>
                <InfoRow icon="location-outline" label="Destino" value={getRiderDeliveryAddress(item)} />
                <InfoRow icon="person-outline" label="Cliente" value={getRiderCustomerName(item)} />
                <InfoRow icon="time-outline" label="Último cambio" value={formatDateTime(orderTime(item))} />
                <InfoRow icon="wallet-outline" label="Tu pago" value={formatCurrency(item.rider_fee)} strong />
              </View>

              <View style={styles.stepRow}>
                <Ionicons name={item.otp_required ? "keypad-outline" : "checkmark-circle-outline"} size={18} color={item.otp_required ? colors.warning : colors.success} />
                <Text style={styles.stepText}>{nextStepForOrder(item)}</Text>
                {item.otp_required ? <Text style={styles.codePill}>Código al entregar</Text> : null}
              </View>

              <View style={styles.actions}>
                <AppButton title="Detalle" icon="document-text-outline" onPress={() => navigation.navigate("DeliveryOrderDetail", { orderId: item.id })} variant="ghost" fullWidth />
                <AppButton title="Mapa" icon="map-outline" onPress={() => navigation.navigate("DeliveryRouteMap", { orderId: item.id })} variant="ghost" fullWidth />
                {primaryAction ? (
                  <AppButton
                    title={primaryAction === "accept" ? "Aceptar" : "Retirado"}
                    icon={primaryAction === "accept" ? "checkmark-circle-outline" : "bag-check-outline"}
                    loading={saving}
                    disabled={savingOrderId !== null && !saving}
                    onPress={() => void runAction(primaryAction, item.id)}
                    fullWidth
                  />
                ) : null}
              </View>
            </Card>
          );
        }}
      />
    </Screen>
  );
}

function MetricCard({ icon, label, value, tone }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; tone: "primary" | "success" | "warning" | "neutral" }) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, styles[`${tone}Icon`]]}>
        <Ionicons name={icon} size={18} color={tone === "neutral" ? colors.text : tone === "success" ? colors.success : tone === "warning" ? colors.warning : colors.primary} />
      </View>
      <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>{value}</Text>
      <Text style={styles.metricLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value, strong }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={17} color={colors.primary} />
      <View style={styles.infoCopy}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[styles.infoValue, strong && styles.infoValueStrong]} numberOfLines={2}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
    padding: spacing.md,
    paddingBottom: spacing.xl + 88
  },
  header: {
    gap: spacing.md
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  metricCard: {
    width: "48.7%",
    minHeight: 112,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
    ...shadow.soft
  },
  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs
  },
  primaryIcon: {
    backgroundColor: colors.primarySoft
  },
  successIcon: {
    backgroundColor: colors.successSoft
  },
  warningIcon: {
    backgroundColor: colors.warningSoft
  },
  neutralIcon: {
    backgroundColor: colors.surfaceAlt
  },
  metricValue: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "900"
  },
  metricLabel: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800"
  },
  activeCard: {
    gap: spacing.md,
    backgroundColor: colors.text,
    borderColor: colors.text
  },
  activeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  activeIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary
  },
  activeCopy: {
    flex: 1,
    minWidth: 0
  },
  activeLabel: {
    color: "#FDBA74",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  activeTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
    marginTop: 2
  },
  activeMeta: {
    color: "#CBD5E1",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    marginTop: 2
  },
  activeActions: {
    gap: spacing.sm
  },
  order: {
    gap: spacing.md,
    borderRadius: radii.lg
  },
  orderTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm
  },
  orderTitleWrap: {
    flex: 1,
    minWidth: 0
  },
  orderEyebrow: {
    color: colors.primary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  orderTitle: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "900",
    marginTop: 2
  },
  statusPill: {
    minHeight: 34,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    justifyContent: "center"
  },
  statusText: {
    color: colors.primaryDark,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "900"
  },
  detailGrid: {
    gap: spacing.sm
  },
  infoRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm
  },
  infoCopy: {
    flex: 1,
    minWidth: 0
  },
  infoLabel: {
    color: colors.subtleText,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  infoValue: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
    marginTop: 1
  },
  infoValueStrong: {
    color: colors.success,
    fontSize: 15
  },
  stepRow: {
    minHeight: 44,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  stepText: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "900"
  },
  codePill: {
    overflow: "hidden",
    borderRadius: radii.pill,
    backgroundColor: colors.warningSoft,
    color: colors.warning,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900"
  },
  actions: {
    gap: spacing.sm
  },
  pressed: {
    opacity: opacity.pressed
  }
});
