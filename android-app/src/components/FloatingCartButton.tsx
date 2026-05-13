import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, opacity, radii, shadow, spacing } from "../theme";

type FloatingCartButtonProps = {
  itemCount: number;
  onPress: () => void;
  bottomOffset?: number;
};

export function FloatingCartButton({ itemCount, onPress, bottomOffset = spacing.lg }: FloatingCartButtonProps) {
  if (itemCount <= 0) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir carrito con ${itemCount} productos`}
      hitSlop={8}
      android_ripple={{ color: "rgba(255,255,255,0.22)", borderless: false }}
      onPress={onPress}
      style={({ pressed }) => [styles.fab, { bottom: bottomOffset }, pressed && styles.pressed]}
    >
      <Ionicons name="bag-handle" size={27} color="#FFFFFF" />
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{itemCount > 99 ? "99+" : itemCount}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: spacing.md,
    zIndex: 20,
    width: 60,
    height: 60,
    borderRadius: radii.xl,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.primary
  },
  pressed: {
    opacity: opacity.pressed,
    transform: [{ scale: 0.97 }]
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
