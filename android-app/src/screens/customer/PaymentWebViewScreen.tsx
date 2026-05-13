import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { WebView, type WebViewNavigation } from "react-native-webview";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "../../theme";
import type { RootStackParamList } from "../../navigation/types";
import { useCartState } from "../../state/CartContext";

type Props = NativeStackScreenProps<RootStackParamList, "PaymentWebView">;

export function PaymentWebViewScreen({ route, navigation }: Props) {
  const { checkoutUrl, orderId } = route.params;
  const { refreshCart } = useCartState();
  const [loading, setLoading] = useState(true);

  const returnPaymentStatus = useCallback(
    (url: string) => {
      try {
        const parsed = new URL(url);
        const result =
          parsed.searchParams.get("payment_result") ??
          parsed.searchParams.get("status") ??
          parsed.searchParams.get("collection_status");
        if (parsed.pathname.includes(`/c/pedido/${orderId}`) || parsed.pathname.includes(`/orders/${orderId}`) || parsed.searchParams.get("order_id") === String(orderId)) {
          return result;
        }
        return parsed.pathname.includes("/payments/mercadopago/card") ? result : null;
      } catch {
        return null;
      }
    },
    [orderId]
  );

  function finishPaymentReturn(status: string | null) {
    void refreshCart({ silent: true });
    if (["paid", "approved"].includes((status ?? "").toLowerCase())) {
      navigation.replace("OrderDetail", { orderId });
      return;
    }
    navigation.replace("Checkout");
  }

  function maybeReturnToOrder(navState: WebViewNavigation) {
    const status = returnPaymentStatus(navState.url);
    if (status !== null) {
      finishPaymentReturn(status);
    }
  }

  function handleShouldStartLoad(request: { url: string }) {
    const status = returnPaymentStatus(request.url);
    if (status !== null) {
      finishPaymentReturn(status);
      return false;
    }
    return true;
  }

  return (
    <SafeAreaView style={styles.wrap}>
      <View style={styles.toolbar}>
        <Text style={styles.title}>Pago Mercado Pago</Text>
      </View>
      {loading ? <ActivityIndicator style={styles.loader} color={colors.primary} /> : null}
      <WebView
        source={{ uri: checkoutUrl }}
        originWhitelist={["http://*", "https://*", "mercadopago://*"]}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        mixedContentMode="compatibility"
        onLoadEnd={() => setLoading(false)}
        onNavigationStateChange={maybeReturnToOrder}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
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
