import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, shadow, spacing, typography } from "../theme";

type FeedbackVariant = "success" | "danger" | "warning" | "info";
type FeedbackButtonVariant = "primary" | "ghost" | "danger";

export type AppFeedbackAction = {
  label: string;
  variant?: FeedbackButtonVariant;
  closeOnPress?: boolean;
  onPress?: () => void;
};

export type AppFeedbackDialog = {
  title: string;
  message?: string;
  variant?: FeedbackVariant;
  actions?: AppFeedbackAction[];
};

type AppFeedbackContextValue = {
  showDialog: (dialog: AppFeedbackDialog) => void;
  showSuccess: (title: string, message?: string) => void;
  showError: (title: string, message?: string) => void;
  hideDialog: () => void;
};

const AppFeedbackContext = createContext<AppFeedbackContextValue | null>(null);

const iconByVariant: Record<FeedbackVariant, ComponentProps<typeof Ionicons>["name"]> = {
  success: "checkmark-circle-outline",
  danger: "alert-circle-outline",
  warning: "warning-outline",
  info: "information-circle-outline"
};

const colorByVariant: Record<FeedbackVariant, { icon: string; surface: string }> = {
  success: { icon: colors.success, surface: colors.successSoft },
  danger: { icon: colors.danger, surface: colors.dangerSoft },
  warning: { icon: colors.warning, surface: colors.warningSoft },
  info: { icon: colors.primary, surface: colors.primarySoft }
};

export function AppFeedbackProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<AppFeedbackDialog | null>(null);
  const hideDialog = useCallback(() => setDialog(null), []);

  const showDialog = useCallback((nextDialog: AppFeedbackDialog) => {
    setDialog(nextDialog);
  }, []);

  const value = useMemo<AppFeedbackContextValue>(
    () => ({
      showDialog,
      showSuccess: (title, message) => showDialog({ title, message, variant: "success" }),
      showError: (title, message) => showDialog({ title, message, variant: "danger" }),
      hideDialog
    }),
    [hideDialog, showDialog]
  );

  const variant = dialog?.variant ?? "info";
  const variantColors = colorByVariant[variant];
  const actions = dialog?.actions?.length ? dialog.actions : [{ label: "Entendido", variant: "primary" as const }];

  return (
    <AppFeedbackContext.Provider value={value}>
      {children}
      <Modal animationType="fade" transparent visible={Boolean(dialog)} statusBarTranslucent onRequestClose={hideDialog}>
        <View style={styles.overlay}>
          <View accessibilityRole="alert" accessibilityViewIsModal style={styles.dialog}>
            <View style={[styles.iconWrap, { backgroundColor: variantColors.surface }]}>
              <Ionicons name={iconByVariant[variant]} size={30} color={variantColors.icon} />
            </View>
            <Text style={styles.title}>{dialog?.title}</Text>
            {dialog?.message ? <Text style={styles.message}>{dialog.message}</Text> : null}
            <View style={styles.actions}>
              {actions.map((action) => {
                const buttonVariant = action.variant ?? "primary";
                return (
                  <Pressable
                    key={action.label}
                    accessibilityRole="button"
                    android_ripple={{ color: buttonVariant === "ghost" ? colors.borderStrong : "rgba(255,255,255,0.18)" }}
                    onPress={() => {
                      if (action.closeOnPress !== false) hideDialog();
                      action.onPress?.();
                    }}
                    style={({ pressed }) => [styles.button, styles[`${buttonVariant}Button`], pressed && styles.pressed]}
                  >
                    <Text style={[styles.buttonText, styles[`${buttonVariant}ButtonText`]]}>{action.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </AppFeedbackContext.Provider>
  );
}

export function useAppFeedback() {
  const value = useContext(AppFeedbackContext);
  if (!value) {
    throw new Error("useAppFeedback must be used inside AppFeedbackProvider");
  }
  return value;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.48)",
    padding: spacing.lg
  },
  dialog: {
    width: "100%",
    maxWidth: 420,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.md,
    ...shadow.medium
  },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center"
  },
  title: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "900",
    textAlign: "center"
  },
  message: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center"
  },
  actions: {
    alignSelf: "stretch",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "center",
    marginTop: spacing.xs
  },
  button: {
    minHeight: 48,
    minWidth: 112,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  primaryButton: {
    backgroundColor: colors.primary
  },
  ghostButton: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.border
  },
  dangerButton: {
    backgroundColor: colors.danger
  },
  buttonText: {
    ...typography.button
  },
  primaryButtonText: {
    color: "#FFFFFF"
  },
  ghostButtonText: {
    color: colors.primaryDark
  },
  dangerButtonText: {
    color: "#FFFFFF"
  },
  pressed: {
    opacity: 0.78
  }
});

