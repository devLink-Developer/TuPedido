import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import { colors, radii, spacing, touchTarget, typography } from "../theme";

type TextFieldProps = TextInputProps & {
  label: string;
  error?: string | null;
  leftIcon?: ComponentProps<typeof Ionicons>["name"];
  rightIcon?: ComponentProps<typeof Ionicons>["name"];
  rightActionLabel?: string;
  rightActionSelected?: boolean;
  onRightActionPress?: () => void;
  inputContainerStyle?: StyleProp<ViewStyle>;
};

export function TextField({
  label,
  error,
  leftIcon,
  rightIcon,
  rightActionLabel,
  rightActionSelected,
  onRightActionPress,
  style,
  inputContainerStyle,
  ...props
}: TextFieldProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputShell, error ? styles.inputError : null, inputContainerStyle]}>
        {leftIcon ? <Ionicons name={leftIcon} size={20} color={colors.mutedText} /> : null}
        <TextInput
          placeholderTextColor={colors.subtleText}
          style={[styles.input, style]}
          accessibilityLabel={label}
          accessibilityHint={error ? error : undefined}
          accessibilityState={{ disabled: props.editable === false }}
          {...props}
        />
        {rightIcon && onRightActionPress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={rightActionLabel}
            accessibilityState={{ selected: rightActionSelected }}
            hitSlop={6}
            android_ripple={{ color: colors.borderStrong, borderless: true }}
            style={({ pressed }) => [styles.rightAction, pressed && styles.rightActionPressed]}
            onPress={onRightActionPress}
          >
            <Ionicons name={rightIcon} size={21} color={colors.mutedText} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs
  },
  label: {
    color: colors.text,
    ...typography.label
  },
  inputShell: {
    minHeight: touchTarget.comfortable,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  input: {
    flex: 1,
    minHeight: touchTarget.min,
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    paddingVertical: spacing.sm
  },
  inputError: {
    borderColor: colors.danger
  },
  rightAction: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md
  },
  rightActionPressed: {
    backgroundColor: colors.primarySoft
  },
  error: {
    color: colors.danger,
    ...typography.caption
  }
});
