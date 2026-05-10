import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../theme";

type RatingStarsProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  helperText?: string;
};

export function RatingStars({ label, value, onChange, helperText }: RatingStarsProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}/5</Text>
      </View>
      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {[1, 2, 3, 4, 5].map((star) => {
          const selected = star <= value;
          return (
            <Pressable
              key={star}
              accessibilityRole="radio"
              accessibilityLabel={`${star} ${star === 1 ? "estrella" : "estrellas"}`}
              accessibilityState={{ selected: star === value }}
              hitSlop={4}
              onPress={() => onChange(star)}
              style={({ pressed }) => [styles.starButton, pressed && styles.pressed]}
            >
              <Ionicons name={selected ? "star" : "star-outline"} size={31} color={selected ? colors.warning : colors.subtleText} />
            </Pressable>
          );
        })}
      </View>
      {helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  label: {
    color: colors.text,
    ...typography.label
  },
  value: {
    color: colors.primaryDark,
    ...typography.label
  },
  row: {
    flexDirection: "row",
    gap: spacing.xs
  },
  starButton: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.border
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.96 }]
  },
  helper: {
    color: colors.mutedText,
    ...typography.caption
  }
});
