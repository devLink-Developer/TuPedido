import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppButton } from "../../components/AppButton";
import { Card } from "../../components/Card";
import { Screen } from "../../components/Screen";
import { SectionHeader } from "../../components/SectionHeader";
import { StateMessage } from "../../components/StateMessage";
import { checkout, fetchAddresses, fetchStore, updateCart } from "../../services/api";
import { useAppFeedback } from "../../state/AppFeedbackContext";
import { useAuth } from "../../state/AuthContext";
import { useCartState } from "../../state/CartContext";
import { colors, radii, spacing } from "../../theme";
import type { Address, StorePaymentSettings } from "../../types/api";
import type { RootStackParamList } from "../../navigation/types";
import { friendlyErrorMessage } from "../../utils/apiMessages";
import { formatCurrency, makeIdempotencyKey } from "../../utils/format";
import { paymentMethodLabels } from "../../utils/labels";

type Props = NativeStackScreenProps<RootStackParamList, "Checkout">;

function hasMercadoPago(settings: StorePaymentSettings | null | undefined) {
  return Boolean(settings?.mercadopago_enabled && settings.mercadopago_configured && settings.mercadopago_provider_enabled);
}

function hasAddressPin(address: Address | null | undefined): address is Address {
  return typeof address?.latitude === "number" && typeof address.longitude === "number" && Number.isFinite(address.latitude) && Number.isFinite(address.longitude);
}

export function CheckoutScreen({ navigation }: Props) {
  const { token } = useAuth();
  const { showDialog, showError } = useAppFeedback();
  const { cart, refreshCart, setCart } = useCartState();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<StorePaymentSettings | null>(null);
  const [addressId, setAddressId] = useState<number | null>(null);
  const [deliveryMode, setDeliveryMode] = useState<"delivery" | "pickup">(cart?.delivery_mode ?? "delivery");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "mercadopago">("cash");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [nextCart, nextAddresses] = await Promise.all([refreshCart({ silent: true }), fetchAddresses(token)]);
      setAddresses(nextAddresses);
      if (nextCart?.store_slug) {
        const store = await fetchStore(nextCart.store_slug).catch(() => null);
        setPaymentSettings(store?.payment_settings ?? null);
      } else {
        setPaymentSettings(null);
      }
      const defaultAddress = nextAddresses.find((item) => item.is_default && hasAddressPin(item)) ?? nextAddresses.find(hasAddressPin) ?? null;
      setAddressId((current) => {
        const currentStillUsable = nextAddresses.some((item) => item.id === current && hasAddressPin(item));
        return currentStillUsable ? current : defaultAddress?.id ?? null;
      });
      if (nextCart?.delivery_mode) setDeliveryMode(nextCart.delivery_mode);
    } finally {
      setLoading(false);
    }
  }, [refreshCart, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const deliveryEnabled = cart?.delivery_settings?.delivery_enabled ?? true;
  const pickupEnabled = cart?.delivery_settings?.pickup_enabled ?? true;
  const pinnedAddresses = useMemo(() => addresses.filter(hasAddressPin), [addresses]);

  const availablePaymentMethods = useMemo<Array<"cash" | "mercadopago">>(() => {
    const methods: Array<"cash" | "mercadopago"> = [];
    if (paymentSettings?.cash_enabled ?? true) methods.push("cash");
    if (hasMercadoPago(paymentSettings)) methods.push("mercadopago");
    return methods.length ? methods : ["cash"];
  }, [paymentSettings]);

  useEffect(() => {
    if (!availablePaymentMethods.includes(paymentMethod)) {
      setPaymentMethod(availablePaymentMethods[0]);
    }
  }, [availablePaymentMethods, paymentMethod]);

  async function selectDeliveryMode(nextMode: "delivery" | "pickup") {
    if (!token) return;
    if (nextMode === "delivery" && !deliveryEnabled) return;
    if (nextMode === "pickup" && !pickupEnabled) return;
    try {
      setDeliveryMode(nextMode);
      setCart(await updateCart(token, nextMode));
    } catch (error) {
      showError("Modalidad no disponible", friendlyErrorMessage(error, "El comercio no permite esa modalidad."));
    }
  }

  async function handleCheckout() {
    if (!token || !cart?.store_id) return;
    const selectedAddress = addresses.find((address) => address.id === addressId) ?? null;
    if (deliveryMode === "delivery") {
      if (!selectedAddress) {
        showDialog({ title: "Dirección requerida", message: "Seleccioná una dirección antes de confirmar el pedido.", variant: "warning" });
        return;
      }
      if (!hasAddressPin(selectedAddress)) {
        showDialog({
          title: "Falta ubicación",
          message: "La dirección elegida no tiene pin en el mapa. Editala desde Perfil y guardá la ubicación.",
          variant: "warning"
        });
        return;
      }
    }

    setLoading(true);
    try {
      const result = await checkout(token, {
        store_id: cart.store_id,
        address_id: deliveryMode === "delivery" ? addressId : null,
        delivery_mode: deliveryMode,
        payment_method: paymentMethod,
        idempotency_key: makeIdempotencyKey()
      });
      await refreshCart({ silent: true }).catch(() => null);
      if (result.checkout_url) {
        navigation.replace("PaymentWebView", { checkoutUrl: result.checkout_url, orderId: result.order_id });
      } else {
        navigation.replace("OrderDetail", { orderId: result.order_id });
      }
    } catch (error) {
      showError("No se pudo crear el pedido", friendlyErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  if (!cart?.items.length) {
    return (
      <Screen>
        <StateMessage title="Carrito vacío" description="Agregá productos antes de confirmar el pedido." actionLabel="Ir al catálogo" onAction={() => navigation.navigate("CustomerTabs", { screen: "Catalog" })} />
      </Screen>
    );
  }

  return (
    <Screen refreshing={loading} onRefresh={() => void load()}>
      <SectionHeader size="large" title="Confirmar pedido" description={cart.store_name ?? "Revisá los datos antes de pedir"} />

      <Card style={styles.card}>
        <Text style={styles.label}>Modalidad</Text>
        <View style={styles.options}>
          {(["delivery", "pickup"] as const).map((mode) => {
            const active = deliveryMode === mode;
            const enabled = mode === "delivery" ? deliveryEnabled : pickupEnabled;
            return (
              <Pressable
                key={mode}
                accessibilityRole="button"
                accessibilityState={{ selected: active, disabled: !enabled }}
                disabled={!enabled || loading}
                onPress={() => void selectDeliveryMode(mode)}
                style={[styles.option, active && styles.optionActive, !enabled && styles.optionDisabled]}
              >
                <Text style={[styles.optionText, active && styles.optionTextActive, !enabled && styles.optionTextDisabled]}>{mode === "delivery" ? "Envío" : "Retiro"}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {deliveryMode === "delivery" ? (
        <Card style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.label}>Dirección</Text>
            <Text style={styles.pinCount}>{pinnedAddresses.length} con mapa</Text>
          </View>
          {addresses.length ? (
            <View style={styles.optionsVertical}>
              {addresses.map((address) => {
                const active = addressId === address.id;
                const hasPin = hasAddressPin(address);
                return (
                  <Pressable
                    key={address.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active, disabled: !hasPin }}
                    disabled={!hasPin}
                    onPress={() => setAddressId(address.id)}
                    style={[styles.option, active && styles.optionActive, !hasPin && styles.optionDisabled]}
                  >
                    <Text style={[styles.optionText, active && styles.optionTextActive, !hasPin && styles.optionTextDisabled]} numberOfLines={2}>
                      {address.label} - {address.street}
                    </Text>
                    <Text style={[styles.addressMeta, active && styles.optionTextActive]}>{hasPin ? "Lista para envío" : "Falta pin de mapa"}</Text>
                  </Pressable>
                );
              })}
              {!pinnedAddresses.length ? (
                <StateMessage title="Ubicación pendiente" description="Para pedir con envío, agregá el pin en el mapa desde Perfil." actionLabel="Ir a perfil" onAction={() => navigation.navigate("CustomerTabs", { screen: "Profile" })} />
              ) : null}
            </View>
          ) : (
            <StateMessage title="Sin direcciones" description="Cargá una dirección desde Perfil antes de continuar." actionLabel="Ir a perfil" onAction={() => navigation.navigate("CustomerTabs", { screen: "Profile" })} />
          )}
        </Card>
      ) : null}

      <Card style={styles.card}>
        <Text style={styles.label}>Pago</Text>
        <View style={styles.options}>
          {availablePaymentMethods.map((method) => {
            const active = paymentMethod === method;
            return (
              <Pressable key={method} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => setPaymentMethod(method)} style={[styles.option, active && styles.optionActive]}>
                <Text style={[styles.optionText, active && styles.optionTextActive]}>{paymentMethodLabels[method]}</Text>
              </Pressable>
            );
          })}
        </View>
        {paymentMethod === "mercadopago" ? <Text style={styles.hint}>Se abrirá el pago con tarjeta dentro de la app y después actualizaremos el pedido.</Text> : null}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.label}>Resumen</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summary}>Subtotal</Text>
          <Text style={styles.summaryValue}>{formatCurrency(cart.pricing.subtotal)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summary}>Envío</Text>
          <Text style={styles.summaryValue}>{formatCurrency(deliveryMode === "pickup" ? 0 : cart.pricing.delivery_fee)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.total}>{formatCurrency(cart.pricing.total)}</Text>
        </View>
        <AppButton title="Confirmar pedido" icon="checkmark-circle-outline" onPress={() => void handleCheckout()} loading={loading} fullWidth />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radii.lg
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md
  },
  label: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  pinCount: {
    color: colors.success,
    fontSize: 12,
    fontWeight: "900"
  },
  options: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  optionsVertical: {
    gap: spacing.sm
  },
  option: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: "center"
  },
  optionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  optionDisabled: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border
  },
  optionText: {
    color: colors.text,
    fontWeight: "800"
  },
  optionTextActive: {
    color: "#FFFFFF"
  },
  optionTextDisabled: {
    color: colors.subtleText
  },
  addressMeta: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3
  },
  hint: {
    color: colors.mutedText,
    lineHeight: 20
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  summary: {
    color: colors.mutedText,
    fontWeight: "700"
  },
  summaryValue: {
    color: colors.text,
    fontWeight: "800"
  },
  divider: {
    height: 1,
    backgroundColor: colors.border
  },
  totalLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  total: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "900"
  }
});
