import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, opacity, radii, shadow, spacing, touchTarget, typography } from "../theme";
import type { Order } from "../types/api";
import { formatCurrency, formatDateTime } from "../utils/format";
import { labelForPaymentMethod, labelForStatus } from "../utils/labels";

export function OrderCard({ order, onPress }: { order: Order; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Abrir pedido ${order.id}`} onPress={onPress} android_ripple={{ color: colors.borderStrong }} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Ionicons name="receipt-outline" size={22} color={colors.primary} />
        </View>
        <View style={styles.main}>
          <Text style={styles.store} numberOfLines={1}>{order.store_name}</Text>
          <Text style={styles.meta} numberOfLines={1}>Pedido {order.id} - {formatDateTime(order.created_at)}</Text>
        </View>
        <Text style={styles.total}>{formatCurrency(order.total)}</Text>
      </View>
      <View style={styles.pills}>
        <Text style={styles.pill}>{labelForStatus(order.status)}</Text>
        <Text style={styles.pill}>{labelForStatus(order.payment_status)}</Text>
        <Text style={styles.pill}>{labelForPaymentMethod(order.payment_method)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
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
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center"
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  main: {
    flex: 1,
    minWidth: 0
  },
  store: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  meta: {
    marginTop: 3,
    color: colors.mutedText,
    ...typography.caption
  },
  total: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900"
  },
  pills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  pill: {
    overflow: "hidden",
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    color: colors.primaryDark,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800"
  }
});
