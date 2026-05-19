import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type PressableProps } from "react-native";
import { colors, opacity, radii, spacing, touchTarget, typography } from "../theme";

type Variant = "primary" | "secondary" | "ghost" | "danger";

type AppButtonProps = PressableProps & {
  title: string;
  variant?: Variant;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: ComponentProps<typeof Ionicons>["name"];
};

export function AppButton({ title, variant = "primary", loading, disabled, fullWidth = false, icon, style, ...props }: AppButtonProps) {
  const isDisabled = disabled || loading;
  const labelColor = isDisabled ? colors.mutedText : variant === "ghost" ? colors.primaryDark : "#FFFFFF";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: Boolean(loading) }}
      disabled={isDisabled}
      hitSlop={4}
      android_ripple={isDisabled ? undefined : { color: variant === "ghost" ? colors.borderStrong : "rgba(255,255,255,0.22)" }}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        typeof style === "function" ? style({ pressed }) : style
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === "ghost" ? colors.primary : "#FFFFFF"} />
      ) : (
        <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={18} color={labelColor} /> : null}
          <Text style={[styles.label, styles[`${variant}Label`], isDisabled && styles.disabledLabel]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    minWidth: touchTarget.min,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm
  },
  fullWidth: {
    alignSelf: "stretch"
  },
  primary: {
    backgroundColor: colors.primary
  },
  secondary: {
    backgroundColor: colors.accent
  },
  ghost: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.border
  },
  danger: {
    backgroundColor: colors.danger
  },
  pressed: {
    opacity: opacity.pressed
  },
  disabled: {
    backgroundColor: colors.disabled,
    borderColor: colors.disabled,
    opacity: opacity.disabled
  },
  label: {
    ...typography.button
  },
  primaryLabel: {
    color: "#FFFFFF"
  },
  secondaryLabel: {
    color: "#FFFFFF"
  },
  ghostLabel: {
    color: colors.primaryDark
  },
  dangerLabel: {
    color: "#FFFFFF"
  },
  disabledLabel: {
    color: colors.mutedText
  }
});
