import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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

type AppFeedbackToast = {
  id: string;
  title: string;
  variant: FeedbackVariant;
  durationMs: number;
};

type AppFeedbackContextValue = {
  showDialog: (dialog: AppFeedbackDialog) => void;
  showToast: (title: string, options?: { durationMs?: number; variant?: FeedbackVariant }) => void;
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
  const [toast, setToast] = useState<AppFeedbackToast | null>(null);
  const hideDialog = useCallback(() => setDialog(null), []);

  const showDialog = useCallback((nextDialog: AppFeedbackDialog) => {
    setDialog(nextDialog);
  }, []);

  const showToast = useCallback((title: string, options?: { durationMs?: number; variant?: FeedbackVariant }) => {
    setToast({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      variant: options?.variant ?? "success",
      durationMs: options?.durationMs ?? 3000
    });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast((current) => (current?.id === toast.id ? null : current));
    }, toast.durationMs);
    return () => clearTimeout(timer);
  }, [toast]);

  const value = useMemo<AppFeedbackContextValue>(
    () => ({
      showDialog,
      showToast,
      showSuccess: (title, message) => showDialog({ title, message, variant: "success" }),
      showError: (title, message) => showDialog({ title, message, variant: "danger" }),
      hideDialog
    }),
    [hideDialog, showDialog, showToast]
  );

  const variant = dialog?.variant ?? "info";
  const variantColors = colorByVariant[variant];
  const toastVariant = toast?.variant ?? "success";
  const toastColors = colorByVariant[toastVariant];
  const actions = dialog?.actions?.length ? dialog.actions : [{ label: "Entendido", variant: "primary" as const }];

  return (
    <AppFeedbackContext.Provider value={value}>
      {children}
      {toast ? (
        <SafeAreaView pointerEvents="none" style={styles.toastHost}>
          <View accessibilityRole="alert" style={styles.toast}>
            <Ionicons name={iconByVariant[toastVariant]} size={18} color={toastColors.icon} />
            <Text numberOfLines={1} style={styles.toastText}>
              {toast.title}
            </Text>
          </View>
        </SafeAreaView>
      ) : null}
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
  toastHost: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    elevation: 20,
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm
  },
  toast: {
    maxWidth: 320,
    minHeight: 40,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    ...shadow.soft
  },
  toastText: {
    ...typography.button,
    color: colors.text,
    flexShrink: 1
  },
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
