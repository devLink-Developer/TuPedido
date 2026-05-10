import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../theme";
import { AppButton } from "./AppButton";

export function StateMessage({
  title,
  description,
  loading,
  actionLabel,
  onAction
}: {
  title: string;
  description?: string;
  loading?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.wrap}>
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {actionLabel && onAction ? <AppButton title={actionLabel} onPress={onAction} variant="ghost" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.lg
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center"
  },
  description: {
    color: colors.mutedText,
    ...typography.body,
    textAlign: "center"
  }
});
