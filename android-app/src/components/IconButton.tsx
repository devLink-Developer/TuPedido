import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View, type PressableProps } from "react-native";
import { colors, opacity, radii, shadow, spacing, touchTarget } from "../theme";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

type IconButtonProps = PressableProps & {
  icon: IoniconName;
  label: string;
  badge?: number;
  tone?: "surface" | "primary" | "dark";
};

export function IconButton({ icon, label, badge, tone = "surface", style, ...props }: IconButtonProps) {
  const isDisabled = Boolean(props.disabled);
  const foreground = isDisabled ? colors.mutedText : tone === "surface" ? colors.text : "#FFFFFF";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled }}
      hitSlop={8}
      android_ripple={isDisabled ? undefined : { color: tone === "surface" ? colors.borderStrong : "rgba(255,255,255,0.22)", borderless: false }}
      style={({ pressed }) => [
        styles.base,
        styles[tone],
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        typeof style === "function" ? style({ pressed }) : style
      ]}
      {...props}
    >
      <Ionicons name={icon} size={23} color={foreground} />
      {badge && badge > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? "99+" : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: touchTarget.comfortable,
    height: touchTarget.comfortable,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center"
  },
  surface: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft
  },
  primary: {
    backgroundColor: colors.primary,
    ...shadow.primary
  },
  dark: {
    backgroundColor: colors.text
  },
  pressed: {
    opacity: opacity.pressed
  },
  disabled: {
    opacity: opacity.disabled
  },
  badge: {
    position: "absolute",
    right: -5,
    top: -5,
    minWidth: 24,
    height: 24,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: "center",
    justifyContent: "center"
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900"
  }
});
