import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { WebView, type WebViewNavigation } from "react-native-webview";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "../../components/AppButton";
import { colors, spacing } from "../../theme";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "PaymentWebView">;

export function PaymentWebViewScreen({ route, navigation }: Props) {
  const { checkoutUrl, orderId } = route.params;
  const [loading, setLoading] = useState(true);

  function maybeReturnToOrder(navState: WebViewNavigation) {
    if (navState.url.includes(`/c/pedido/${orderId}`) || navState.url.includes(`order_id=${orderId}`)) {
      navigation.replace("OrderDetail", { orderId });
    }
  }

  return (
    <SafeAreaView style={styles.wrap}>
      <View style={styles.toolbar}>
        <Text style={styles.title}>Pago Mercado Pago</Text>
        <AppButton title="Ver pedido" icon="receipt-outline" onPress={() => navigation.replace("OrderDetail", { orderId })} variant="ghost" />
      </View>
      {loading ? <ActivityIndicator style={styles.loader} color={colors.primary} /> : null}
      <WebView
        source={{ uri: checkoutUrl }}
        onLoadEnd={() => setLoading(false)}
        onNavigationStateChange={maybeReturnToOrder}
        startInLoadingState
        style={styles.webview}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.background
  },
  toolbar: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  loader: {
    position: "absolute",
    top: 92,
    alignSelf: "center",
    zIndex: 2
  },
  webview: {
    flex: 1
  }
});
