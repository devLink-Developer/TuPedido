import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from "react-native";
import { colors, opacity, radii, shadow, spacing, touchTarget, typography } from "../theme";
import type { Order } from "../types/api";
import { formatCurrency, formatDateTime } from "../utils/format";
import { labelForStatus } from "../utils/labels";

function statusStyles(status: string) {
  if (status === "delivered") return { wrap: styles.statusSuccess, label: styles.statusSuccessText, iconColor: colors.success };
  if (["cancelled", "delivery_failed"].includes(status)) return { wrap: styles.statusDanger, label: styles.statusDangerText, iconColor: colors.danger };
  return { wrap: styles.statusActive, label: styles.statusActiveText, iconColor: colors.primaryDark };
}

function itemCountLabel(count: number) {
  return count === 1 ? "1 producto" : `${count} productos`;
}

export function OrderCard({
  order,
  onPress,
  onRepeat,
  repeatLoading
}: {
  order: Order;
  onPress: () => void;
  onRepeat?: () => void;
  repeatLoading?: boolean;
}) {
  const status = statusStyles(order.status);
  const itemCount = order.items.reduce((total, item) => total + item.quantity, 0);
  const handleRepeat = (event: GestureResponderEvent) => {
    event.stopPropagation();
    if (repeatLoading) return;
    onRepeat?.();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir pedido ${order.id} de ${order.store_name}`}
      onPress={onPress}
      android_ripple={{ color: colors.borderStrong }}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.topRow}>
        <View style={[styles.statusPill, status.wrap]}>
          <Ionicons name="checkmark-circle" size={16} color={status.iconColor} />
          <Text style={[styles.statusText, status.label]} numberOfLines={1}>
            {labelForStatus(order.status)}
          </Text>
        </View>
        <Text style={styles.date} numberOfLines={1}>
          {formatDateTime(order.created_at)}
        </Text>
      </View>

      <View style={styles.bodyRow}>
        <View style={styles.main}>
          <Text style={styles.store} numberOfLines={2}>
            {order.store_name}
          </Text>
          <View style={styles.countRow}>
            <Ionicons name="cube-outline" size={15} color={colors.mutedText} />
            <Text style={styles.meta} numberOfLines={1}>
              {itemCountLabel(itemCount)}
            </Text>
          </View>
        </View>
        <Text style={styles.total} numberOfLines={1}>
          {formatCurrency(order.total)}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Repetir pedido de ${order.store_name}`}
        onPress={handleRepeat}
        disabled={!onRepeat || repeatLoading}
        hitSlop={4}
        android_ripple={onRepeat && !repeatLoading ? { color: colors.borderStrong } : undefined}
        style={({ pressed }) => [
          styles.repeatButton,
          pressed && onRepeat && !repeatLoading && styles.pressed,
          (!onRepeat || repeatLoading) && styles.repeatDisabled
        ]}
      >
        <Ionicons name="refresh-outline" size={18} color={onRepeat && !repeatLoading ? colors.primaryDark : colors.mutedText} />
        <Text style={[styles.repeatText, (!onRepeat || repeatLoading) && styles.repeatTextDisabled]}>
          {repeatLoading ? "Actualizando precios" : "Repetir pedido"}
        </Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    minHeight: touchTarget.comfortable,
    ...shadow.soft
  },
  pressed: {
    opacity: opacity.pressed
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  statusPill: {
    minHeight: 32,
    maxWidth: "58%",
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  statusSuccess: {
    backgroundColor: colors.successSoft
  },
  statusSuccessText: {
    color: colors.success
  },
  statusDanger: {
    backgroundColor: colors.dangerSoft
  },
  statusDangerText: {
    color: colors.danger
  },
  statusActive: {
    backgroundColor: colors.primarySoft
  },
  statusActiveText: {
    color: colors.primaryDark
  },
  statusText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900"
  },
  date: {
    flex: 1,
    color: colors.mutedText,
    textAlign: "right",
    ...typography.caption
  },
  bodyRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start"
  },
  main: {
    flex: 1,
    minWidth: 0
  },
  store: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900"
  },
  meta: {
    color: colors.mutedText,
    ...typography.caption
  },
  countRow: {
    marginTop: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  total: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
    maxWidth: "42%",
    textAlign: "right"
  },
  repeatButton: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.primarySoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md
  },
  repeatDisabled: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border
  },
  repeatText: {
    color: colors.primaryDark,
    ...typography.button
  },
  repeatTextDisabled: {
    color: colors.mutedText
  }
});
