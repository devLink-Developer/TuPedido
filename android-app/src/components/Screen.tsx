import { RefreshControl, ScrollView, StyleSheet, View, type ScrollViewProps } from "react-native";
import type { ReactNode } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "../theme";

type ScreenProps = ScrollViewProps & {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  noScroll?: boolean;
};

export function Screen({ children, refreshing, onRefresh, noScroll, contentContainerStyle, ...props }: ScreenProps) {
  if (noScroll) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.noScroll}>{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        contentContainerStyle={[styles.content, contentContainerStyle]}
        refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
        {...props}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl
  },
  noScroll: {
    flex: 1,
    backgroundColor: colors.background
  }
});
