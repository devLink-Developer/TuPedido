import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "../../components/AppButton";
import { OrderCard } from "../../components/OrderCard";
import { Screen } from "../../components/Screen";
import { StateMessage } from "../../components/StateMessage";
import { fetchOrders } from "../../services/api";
import { useAppFeedback } from "../../state/AppFeedbackContext";
import { useAuth } from "../../state/AuthContext";
import { useCartState } from "../../state/CartContext";
import { useNotificationsState } from "../../state/NotificationsContext";
import { colors, opacity, radii, spacing, touchTarget, typography } from "../../theme";
import type { CustomerTabsParamList, RootStackParamList } from "../../navigation/types";
import type { Order } from "../../types/api";
import { friendlyErrorMessage } from "../../utils/apiMessages";
import { CUSTOMER_ORDER_STATUS_NOTIFICATION_EVENTS } from "../../utils/orders";
import { repeatOrderFeedback, repeatOrderIntoCart } from "../../utils/repeatOrder";

type Props = BottomTabScreenProps<CustomerTabsParamList, "Orders">;
type RootNav = NativeStackNavigationProp<RootStackParamList>;
type PeriodFilter = "all" | "30d" | "90d";
type StatusFilter = "all" | "active" | "delivered" | "cancelled";

const LIVE_ORDERS_REFRESH_MS = 10000;

const PERIOD_OPTIONS: Array<{ value: PeriodFilter; label: string; description: string }> = [
  { value: "all", label: "Todos", description: "Ver todo el historial" },
  { value: "30d", label: "Ultimos 30 dias", description: "Pedidos recientes" },
  { value: "90d", label: "Ultimos 90 dias", description: "Pedidos del trimestre" }
];

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string; description: string }> = [
  { value: "all", label: "Todos", description: "Sin filtrar por estado" },
  { value: "active", label: "En curso", description: "Pedidos activos o pendientes" },
  { value: "delivered", label: "Entregados", description: "Pedidos completados" },
  { value: "cancelled", label: "Cancelados", description: "Pedidos cancelados o fallidos" }
];

function isOrderInPeriod(order: Order, period: PeriodFilter) {
  if (period === "all") return true;
  const createdAt = new Date(order.created_at).getTime();
  if (Number.isNaN(createdAt)) return true;
  const days = period === "30d" ? 30 : 90;
  return Date.now() - createdAt <= days * 24 * 60 * 60 * 1000;
}

function isOrderInStatus(order: Order, status: StatusFilter) {
  if (status === "all") return true;
  if (status === "delivered") return order.status === "delivered";
  if (status === "cancelled") return ["cancelled", "delivery_failed"].includes(order.status);
  return !["delivered", "cancelled", "delivery_failed"].includes(order.status);
}

function periodLabel(period: PeriodFilter) {
  return PERIOD_OPTIONS.find((option) => option.value === period)?.label ?? "Periodo";
}

export function OrdersScreen(_props: Props) {
  const navigation = useNavigation<RootNav>();
  const { token } = useAuth();
  const { setCart } = useCartState();
  const { showDialog } = useAppFeedback();
  const { notifications } = useNotificationsState();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repeatingOrderId, setRepeatingOrderId] = useState<number | null>(null);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [draftStatusFilter, setDraftStatusFilter] = useState<StatusFilter>("all");
  const [draftPeriodFilter, setDraftPeriodFilter] = useState<PeriodFilter>("all");
  const lastHandledNotificationIdRef = useRef<number | null>(null);

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!token) return;
      if (!options?.silent) {
        setLoading(true);
        setError(null);
      }
      try {
        setOrders(await fetchOrders(token));
      } catch (loadError) {
        if (!options?.silent) {
          setError(friendlyErrorMessage(loadError, "No se pudieron cargar los pedidos"));
        }
      } finally {
        if (!options?.silent) {
          setLoading(false);
        }
      }
    },
    [token]
  );

  useFocusEffect(
    useCallback(() => {
      void load();
      const timer = setInterval(() => {
        void load({ silent: true });
      }, LIVE_ORDERS_REFRESH_MS);

      return () => {
        clearInterval(timer);
      };
    }, [load])
  );

  useEffect(() => {
    const latestOrderNotification = notifications.find(
      (notification) => notification.order_id && CUSTOMER_ORDER_STATUS_NOTIFICATION_EVENTS.has(notification.event_type)
    );
    if (!latestOrderNotification || latestOrderNotification.id === lastHandledNotificationIdRef.current) {
      return;
    }

    lastHandledNotificationIdRef.current = latestOrderNotification.id;
    void load({ silent: true });
  }, [load, notifications]);

  const filteredOrders = useMemo(
    () => orders.filter((order) => isOrderInPeriod(order, periodFilter) && isOrderInStatus(order, statusFilter)),
    [orders, periodFilter, statusFilter]
  );

  const openFilters = useCallback(() => {
    setDraftStatusFilter(statusFilter);
    setDraftPeriodFilter(periodFilter);
    setFiltersVisible(true);
  }, [periodFilter, statusFilter]);

  const applyFilters = useCallback(() => {
    setStatusFilter(draftStatusFilter);
    setPeriodFilter(draftPeriodFilter);
    setFiltersVisible(false);
  }, [draftPeriodFilter, draftStatusFilter]);

  const clearFilters = useCallback(() => {
    setDraftStatusFilter("all");
    setDraftPeriodFilter("all");
  }, []);

  const repeatOrder = useCallback(
    async (order: Order) => {
      if (!token) {
        showDialog({
          title: "Inicia sesion",
          message: "Para repetir un pedido necesitamos actualizar el carrito con los precios vigentes.",
          variant: "info",
          actions: [
            { label: "Cancelar", variant: "ghost" },
            { label: "Ingresar", onPress: () => navigation.navigate("Auth", { screen: "Login" }) }
          ]
        });
        return;
      }

      setRepeatingOrderId(order.id);
      try {
        const result = await repeatOrderIntoCart(token, order);
        if (result.cart) {
          setCart(result.cart);
        }
        const feedback = repeatOrderFeedback(result);
        showDialog({
          ...feedback,
          actions:
            result.addedItemCount > 0
              ? [
                  { label: "Seguir", variant: "ghost" },
                  { label: "Ver carrito", onPress: () => navigation.navigate("Cart") }
                ]
              : undefined
        });
      } finally {
        setRepeatingOrderId(null);
      }
    },
    [navigation, setCart, showDialog, token]
  );

  const header = (
    <View style={styles.headerWrap}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.title}>Mis pedidos</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Abrir carrito"
          onPress={() => navigation.navigate("Cart")}
          hitSlop={4}
          android_ripple={{ color: colors.borderStrong }}
          style={({ pressed }) => [styles.cartButton, pressed && styles.pressed]}
        >
          <Ionicons name="cart-outline" size={22} color={colors.primaryDark} />
        </Pressable>
      </View>
      <Text style={[styles.description, error && styles.errorText]}>{error ?? "Historial y estado en vivo."}</Text>
      <View style={styles.chipRow}>
        <FilterChip icon="options-outline" label="Filtros" active={statusFilter !== "all" || periodFilter !== "all"} onPress={openFilters} />
        <FilterChip
          icon="checkmark-circle-outline"
          label="Entregados"
          active={statusFilter === "delivered"}
          onPress={() => setStatusFilter(statusFilter === "delivered" ? "all" : "delivered")}
        />
        <FilterChip
          icon="close-circle-outline"
          label="Cancelados"
          active={statusFilter === "cancelled"}
          onPress={() => setStatusFilter(statusFilter === "cancelled" ? "all" : "cancelled")}
        />
        <FilterChip icon="calendar-outline" label={periodFilter === "all" ? "Periodo" : periodLabel(periodFilter)} active={periodFilter !== "all"} onPress={openFilters} />
      </View>
    </View>
  );

  return (
    <Screen noScroll>
      <View style={styles.wrap}>
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => String(item.id)}
          refreshing={loading}
          onRefresh={() => void load()}
          contentContainerStyle={styles.list}
          ListHeaderComponent={header}
          ListEmptyComponent={
            !loading ? (
              <StateMessage
                title={orders.length ? "Sin resultados" : "Sin pedidos"}
                description={orders.length ? "Proba ajustar los filtros para encontrar otros pedidos." : "Cuando hagas tu primer pedido aparecera aca."}
              />
            ) : null
          }
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              onPress={() => navigation.navigate("OrderDetail", { orderId: item.id })}
              onRepeat={() => void repeatOrder(item)}
              repeatLoading={repeatingOrderId === item.id}
            />
          )}
        />
      </View>
      <FilterModal
        visible={filtersVisible}
        status={draftStatusFilter}
        period={draftPeriodFilter}
        onStatusChange={setDraftStatusFilter}
        onPeriodChange={setDraftPeriodFilter}
        onClear={clearFilters}
        onApply={applyFilters}
        onClose={() => setFiltersVisible(false)}
      />
    </Screen>
  );
}

function FilterChip({
  icon,
  label,
  active,
  onPress
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Filtro ${label}`}
      accessibilityState={{ selected: Boolean(active) }}
      onPress={onPress}
      hitSlop={4}
      android_ripple={{ color: colors.borderStrong }}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={17} color={active ? colors.primaryDark : colors.mutedText} />
      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function FilterModal({
  visible,
  status,
  period,
  onStatusChange,
  onPeriodChange,
  onClear,
  onApply,
  onClose
}: {
  visible: boolean;
  status: StatusFilter;
  period: PeriodFilter;
  onStatusChange: (value: StatusFilter) => void;
  onPeriodChange: (value: PeriodFilter) => void;
  onClear: () => void;
  onApply: () => void;
  onClose: () => void;
}) {
  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe}>
        <View style={styles.modalHeader}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar filtros"
            onPress={onClose}
            hitSlop={4}
            android_ripple={{ color: colors.borderStrong }}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.modalTitle}>Filtros</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Limpiar filtros" onPress={onClear} hitSlop={4} style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}>
            <Text style={styles.clearText}>Limpiar</Text>
          </Pressable>
        </View>

        <View style={styles.modalBody}>
          <FilterGroup title="Periodo">
            {PERIOD_OPTIONS.map((option) => (
              <RadioOption key={option.value} label={option.label} description={option.description} selected={period === option.value} onPress={() => onPeriodChange(option.value)} />
            ))}
          </FilterGroup>

          <FilterGroup title="Estado">
            {STATUS_OPTIONS.map((option) => (
              <RadioOption key={option.value} label={option.label} description={option.description} selected={status === option.value} onPress={() => onStatusChange(option.value)} />
            ))}
          </FilterGroup>
        </View>

        <View style={styles.modalFooter}>
          <AppButton title="Aplicar" icon="checkmark-outline" onPress={onApply} fullWidth />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={title} style={styles.optionStack}>
        {children}
      </View>
    </View>
  );
}

function RadioOption({ label, description, selected, onPress }: { label: string; description: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      android_ripple={{ color: colors.borderStrong }}
      style={({ pressed }) => [styles.radioOption, selected && styles.radioOptionSelected, pressed && styles.pressed]}
    >
      <View style={styles.radioCopy}>
        <Text style={styles.radioLabel}>{label}</Text>
        <Text style={styles.radioDescription}>{description}</Text>
      </View>
      <Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={23} color={selected ? colors.primary : colors.mutedText} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingHorizontal: spacing.md
  },
  list: {
    gap: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl
  },
  headerWrap: {
    gap: spacing.md
  },
  header: {
    minHeight: touchTarget.min,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  headerSpacer: {
    width: touchTarget.min,
    height: touchTarget.min
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
    textAlign: "center"
  },
  cartButton: {
    width: touchTarget.min,
    height: touchTarget.min,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center"
  },
  description: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center"
  },
  errorText: {
    color: colors.warning,
    fontWeight: "800"
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  chip: {
    minHeight: touchTarget.min,
    maxWidth: "100%",
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  chipActive: {
    borderColor: colors.borderStrong,
    backgroundColor: colors.primarySoft
  },
  chipText: {
    color: colors.mutedText,
    ...typography.button
  },
  chipTextActive: {
    color: colors.primaryDark
  },
  pressed: {
    opacity: opacity.pressed
  },
  modalSafe: {
    flex: 1,
    backgroundColor: colors.background
  },
  modalHeader: {
    minHeight: 64,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  iconButton: {
    width: touchTarget.min,
    height: touchTarget.min,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center"
  },
  modalTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "900",
    textAlign: "center"
  },
  clearButton: {
    minWidth: touchTarget.min,
    minHeight: touchTarget.min,
    alignItems: "flex-end",
    justifyContent: "center"
  },
  clearText: {
    color: colors.primaryDark,
    ...typography.button
  },
  modalBody: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.lg
  },
  filterGroup: {
    gap: spacing.sm
  },
  groupTitle: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900"
  },
  optionStack: {
    gap: spacing.sm
  },
  radioOption: {
    minHeight: 64,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  radioOptionSelected: {
    borderColor: colors.borderStrong,
    backgroundColor: colors.primarySoft
  },
  radioCopy: {
    flex: 1,
    minWidth: 0
  },
  radioLabel: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900"
  },
  radioDescription: {
    marginTop: 2,
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 16
  },
  modalFooter: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface
  }
});
