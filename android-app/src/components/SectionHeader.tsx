import { StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../theme";

export function SectionHeader({
  eyebrow,
  title,
  description,
  size = "regular"
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  size?: "compact" | "regular" | "large";
}) {
  return (
    <View style={styles.wrap}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={[styles.title, styles[`${size}Title`]]}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
    marginBottom: spacing.md
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  title: {
    color: colors.text,
    fontWeight: "900"
  },
  compactTitle: {
    fontSize: 17,
    lineHeight: 22
  },
  regularTitle: {
    fontSize: 20,
    lineHeight: 26
  },
  largeTitle: {
    fontSize: 24,
    lineHeight: 30
  },
  description: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 19
  }
});
