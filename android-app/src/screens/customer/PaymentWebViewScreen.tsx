import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { WebView, type WebViewNavigation } from "react-native-webview";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "../../theme";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "PaymentWebView">;

export function PaymentWebViewScreen({ route, navigation }: Props) {
  const { checkoutUrl, orderId } = route.params;
  const [loading, setLoading] = useState(true);

  const shouldReturnToOrder = useCallback(
    (url: string) => {
      try {
        const parsed = new URL(url);
        const result =
          parsed.searchParams.get("payment_result") ??
          parsed.searchParams.get("status") ??
          parsed.searchParams.get("collection_status");
        const paid = ["paid", "approved"].includes((result ?? "").toLowerCase());
        if (parsed.pathname.includes(`/c/pedido/${orderId}`) || parsed.pathname.includes(`/orders/${orderId}`) || parsed.searchParams.get("order_id") === String(orderId)) {
          return paid || result === null;
        }
        return parsed.pathname.includes("/payments/mercadopago/card") && paid;
      } catch {
        return false;
      }
    },
    [orderId]
  );

  function maybeReturnToOrder(navState: WebViewNavigation) {
    if (shouldReturnToOrder(navState.url)) {
      navigation.replace("OrderDetail", { orderId });
    }
  }

  function handleShouldStartLoad(request: { url: string }) {
    if (shouldReturnToOrder(request.url)) {
      navigation.replace("OrderDetail", { orderId });
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
