import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, opacity, radii, shadow, spacing, touchTarget } from "../theme";
import type { Address } from "../types/api";

type AddressAction = {
  label: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
  variant?: "default" | "danger";
};

type Props = {
  address: Address;
  selected?: boolean;
  disabled?: boolean;
  compact?: boolean;
  onPress?: () => void;
  actions?: AddressAction[];
  footer?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function CustomerAddressCard({
  address,
  selected = false,
  disabled = false,
  compact = false,
  onPress,
  actions = [],
  footer,
  style
}: Props) {
  const hasPin = typeof address.latitude === "number" && typeof address.longitude === "number";
  const actionable = Boolean(onPress);
  const accessibilityState = actionable ? { selected, disabled } : undefined;

  return (
    <Pressable
      accessibilityRole={actionable ? "button" : undefined}
      accessibilityState={accessibilityState}
      disabled={!actionable || disabled}
      android_ripple={actionable && !disabled ? { color: colors.borderStrong } : undefined}
      onPress={onPress}
      style={({ pressed }: { pressed: boolean }) => [
        styles.card,
        compact && styles.cardCompact,
        selected && styles.cardSelected,
        disabled && styles.cardDisabled,
        pressed && !disabled && styles.pressed,
        style
      ]}
    >
      <View style={styles.topRow}>
        <View style={[styles.iconWrap, selected && styles.iconWrapSelected]}>
          <Ionicons name={selected ? "navigate-circle" : address.is_default ? "home" : "location-outline"} size={22} color={selected ? "#FFFFFF" : colors.primary} />
        </View>
        <View style={styles.main}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>{address.label || "Dirección"}</Text>
            {selected ? <Text style={[styles.badge, styles.selectedBadge]}>Seleccionada</Text> : null}
            {address.is_default ? <Text style={styles.badge}>Predeterminada</Text> : null}
          </View>
          <Text style={styles.street} numberOfLines={1}>{address.street || "Sin calle cargada"}</Text>
          <Text style={styles.meta} numberOfLines={1}>{[address.locality, address.province, address.postal_code].filter(Boolean).join(" - ")}</Text>
        </View>
      </View>

      <View style={styles.bottomRow}>
        <View style={[styles.pinPill, hasPin ? styles.pinPillReady : styles.pinPillMissing]}>
          <Ionicons name={hasPin ? "checkmark-circle" : "alert-circle-outline"} size={15} color={hasPin ? colors.success : colors.warning} />
          <Text style={[styles.pinText, hasPin ? styles.pinTextReady : styles.pinTextMissing]}>{hasPin ? "Pin confirmado" : "Falta pin"}</Text>
        </View>
        {footer}
      </View>

      {actions.length ? (
        <View style={styles.actions}>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              hitSlop={4}
              android_ripple={{ color: action.variant === "danger" ? colors.dangerSoft : colors.borderStrong }}
              onPress={action.onPress}
              style={({ pressed }) => [styles.actionButton, action.variant === "danger" && styles.actionDanger, pressed && styles.pressed]}
            >
              <Ionicons name={action.icon} size={17} color={action.variant === "danger" ? colors.danger : colors.primaryDark} />
              <Text style={[styles.actionText, action.variant === "danger" && styles.actionTextDanger]}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 112,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.soft
  },
  cardCompact: {
    minHeight: 104,
    padding: spacing.sm
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  cardDisabled: {
    opacity: opacity.disabled
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  iconWrapSelected: {
    backgroundColor: colors.primary
  },
  main: {
    flex: 1,
    minWidth: 0,
    gap: 3
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  title: {
    flexShrink: 1,
    color: colors.text,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "900"
  },
  badge: {
    overflow: "hidden",
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceAlt,
    color: colors.primaryDark,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "900"
  },
  selectedBadge: {
    backgroundColor: colors.text,
    color: "#FFFFFF"
  },
  street: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800"
  },
  meta: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 17
  },
  bottomRow: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  pinPill: {
    minHeight: 30,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  pinPillReady: {
    backgroundColor: colors.successSoft
  },
  pinPillMissing: {
    backgroundColor: colors.warningSoft
  },
  pinText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900"
  },
  pinTextReady: {
    color: colors.success
  },
  pinTextMissing: {
    color: colors.warning
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingTop: spacing.xs
  },
  actionButton: {
    minHeight: touchTarget.min,
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs
  },
  actionDanger: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerSoft
  },
  actionText: {
    color: colors.primaryDark,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900"
  },
  actionTextDanger: {
    color: colors.danger
  },
  pressed: {
    opacity: opacity.pressed
  }
});
