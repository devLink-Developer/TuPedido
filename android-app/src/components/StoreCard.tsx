import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, opacity, radii, shadow, spacing, typography } from "../theme";
import type { StoreSummary } from "../types/api";
import { formatCurrency } from "../utils/format";

export function StoreCard({ store, onPress }: { store: StoreSummary; onPress: () => void }) {
  const isOpen = store.accepting_orders && store.is_open;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir ${store.name}`}
      onPress={onPress}
      android_ripple={{ color: colors.borderStrong }}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.coverWrap}>
        {store.cover_image_url ? (
          <Image source={{ uri: store.cover_image_url }} style={styles.cover} accessibilityLabel={`Portada de ${store.name}`} />
        ) : (
          <View style={styles.coverFallback} />
        )}
        <View style={[styles.statusBadge, isOpen ? styles.open : styles.closed]}>
          <Ionicons name={isOpen ? "checkmark-circle" : "close-circle"} size={14} color={isOpen ? colors.success : colors.danger} />
          <Text style={[styles.statusText, isOpen ? styles.statusTextOpen : styles.statusTextClosed]}>{isOpen ? "Abierto" : "Cerrado"}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <View style={styles.logoWrap}>
            {store.logo_url ? (
              <Image source={{ uri: store.logo_url }} style={styles.logo} accessibilityLabel={`Logo de ${store.name}`} />
            ) : (
              <Text style={styles.logoText}>{store.name.slice(0, 1).toUpperCase()}</Text>
            )}
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.name} numberOfLines={1}>{store.name}</Text>
            <Text style={styles.meta} numberOfLines={1}>{store.primary_category ?? "Comercio"} - {store.locality ?? store.address}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.mutedText} />
        </View>

        <Text style={styles.description} numberOfLines={2}>{store.description || store.address}</Text>

        <View style={styles.pills}>
          <View style={styles.pill}>
            <Ionicons name="time-outline" size={14} color={colors.primaryDark} />
            <Text style={styles.pillText}>{store.min_delivery_minutes}-{store.max_delivery_minutes} min</Text>
          </View>
          <View style={styles.pill}>
            <Ionicons name="bicycle-outline" size={14} color={colors.primaryDark} />
            <Text style={styles.pillText}>Envío {formatCurrency(store.delivery_settings.delivery_fee)}</Text>
          </View>
          {store.rating ? (
            <View style={styles.pill}>
              <Ionicons name="star" size={13} color={colors.warning} />
              <Text style={styles.pillText}>{store.rating.toFixed(1)}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft
  },
  pressed: {
    opacity: opacity.pressed
  },
  coverWrap: {
    position: "relative"
  },
  cover: {
    width: "100%",
    height: 136,
    backgroundColor: colors.surfaceAlt
  },
  coverFallback: {
    height: 136,
    backgroundColor: colors.primarySoft
  },
  statusBadge: {
    position: "absolute",
    left: spacing.sm,
    top: spacing.sm,
    minHeight: 30,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  statusText: {
    fontSize: 12,
    fontWeight: "900"
  },
  statusTextOpen: {
    color: colors.success
  },
  statusTextClosed: {
    color: colors.danger
  },
  body: {
    padding: spacing.md,
    gap: spacing.sm
  },
  titleRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center"
  },
  logoWrap: {
    width: 50,
    height: 50,
    borderRadius: radii.md,
    overflow: "hidden",
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  logo: {
    width: 50,
    height: 50
  },
  logoText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900"
  },
  titleBlock: {
    flex: 1,
    minWidth: 0
  },
  name: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  meta: {
    color: colors.mutedText,
    fontSize: 13
  },
  description: {
    color: colors.mutedText,
    ...typography.body
  },
  pills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  pill: {
    minHeight: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  pillText: {
    color: colors.primaryDark,
    ...typography.caption,
    fontWeight: "800"
  },
  open: {
    backgroundColor: colors.successSoft,
    borderColor: "#BBF7D0"
  },
  closed: {
    backgroundColor: colors.dangerSoft,
    borderColor: "#FECACA"
  }
});
