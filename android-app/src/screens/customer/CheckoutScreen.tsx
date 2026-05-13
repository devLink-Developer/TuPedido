import { useCallback, useEffect, useMemo, useState, type ComponentProps } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Location from "expo-location";
import { AppButton } from "../../components/AppButton";
import { Card } from "../../components/Card";
import { Screen } from "../../components/Screen";
import { SectionHeader } from "../../components/SectionHeader";
import { StateMessage } from "../../components/StateMessage";
import { checkout, fetchAddresses, fetchStore, updateCart } from "../../services/api";
import { useAppFeedback } from "../../state/AppFeedbackContext";
import { useAuth } from "../../state/AuthContext";
import { useCartState } from "../../state/CartContext";
import { colors, opacity, radii, spacing } from "../../theme";
import type { Address, StorePaymentSettings } from "../../types/api";
import type { RootStackParamList } from "../../navigation/types";
import { friendlyErrorMessage } from "../../utils/apiMessages";
import { formatCurrency, makeIdempotencyKey } from "../../utils/format";
import { paymentMethodLabels } from "../../utils/labels";

type Props = NativeStackScreenProps<RootStackParamList, "Checkout">;
type DeliveryMode = "delivery" | "pickup";
type PaymentMethod = "cash" | "mercadopago";
type CustomerLocation = { latitude: number; longitude: number; source: "address" | "gps" };
type PinnedAddress = Address & { latitude: number; longitude: number };
type IconName = ComponentProps<typeof Ionicons>["name"];
const MERCADOPAGO_RETURN_URL = "kepedimos://checkout/mercadopago-return";

type PaymentOption = {
  method: PaymentMethod;
  icon: IconName;
  title: string;
  description?: string;
  available: boolean;
  reason: string | null;
};

function hasMercadoPago(settings: StorePaymentSettings | null | undefined) {
  return Boolean(settings?.mercadopago_enabled && settings.mercadopago_configured && settings.mercadopago_provider_enabled);
}

function mercadoPagoUnavailableReason(settings: StorePaymentSettings | null | undefined) {
  if (!settings) return "Validando configuracion del comercio.";
  if (!settings.mercadopago_enabled) return "El comercio no habilito Mercado Pago.";
  if (!settings.mercadopago_provider_enabled) return "Mercado Pago esta desactivado por la plataforma.";
  if (settings.mercadopago_connection_status === "reconnect_required" || settings.mercadopago_reconnect_required) {
    return "El comercio debe reconectar Mercado Pago.";
  }
  if (settings.mercadopago_connection_status === "onboarding_pending" || settings.mercadopago_onboarding_completed === false) {
    return "El comercio debe completar la activacion de Mercado Pago.";
  }
  if (!settings.mercadopago_configured) return "El comercio todavia no conecto Mercado Pago.";
  return null;
}

function hasAddressPin(address: Address | null | undefined): address is PinnedAddress {
  return typeof address?.latitude === "number" && typeof address.longitude === "number" && Number.isFinite(address.latitude) && Number.isFinite(address.longitude);
}

function buildPaymentOptions(settings: StorePaymentSettings | null | undefined): PaymentOption[] {
  const cashEnabled = settings?.cash_enabled ?? true;
  const mercadoPagoEnabled = hasMercadoPago(settings);
  return [
    {
      method: "cash",
      icon: "cash-outline",
      title: paymentMethodLabels.cash,
      available: cashEnabled,
      reason: cashEnabled ? null : "El comercio no acepta efectivo."
    },
    {
      method: "mercadopago",
      icon: "wallet-outline",
      title: paymentMethodLabels.mercadopago,
      available: mercadoPagoEnabled,
      reason: mercadoPagoEnabled ? null : mercadoPagoUnavailableReason(settings)
    }
  ];
}

function isMercadoPagoHostedCheckout(url: string) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.includes("mercadopago.");
  } catch {
    return false;
  }
}

async function openHostedMercadoPagoCheckout(checkoutUrl: string) {
  try {
    await WebBrowser.openAuthSessionAsync(checkoutUrl, MERCADOPAGO_RETURN_URL);
    return true;
  } catch {
    try {
      await Linking.openURL(checkoutUrl);
      return true;
    } catch {
      return false;
    }
  }
}

export function CheckoutScreen({ navigation }: Props) {
  const { token } = useAuth();
  const { showDialog, showError } = useAppFeedback();
  const { cart, refreshCart, setCart } = useCartState();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<StorePaymentSettings | null>(cart?.payment_settings ?? null);
  const [addressId, setAddressId] = useState<number | null>(null);
  const [customerLocation, setCustomerLocation] = useState<CustomerLocation | null>(null);
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>(cart?.delivery_mode ?? "delivery");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentTouched, setPaymentTouched] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [nextCart, nextAddresses] = await Promise.all([refreshCart({ silent: true }), fetchAddresses(token)]);
      setAddresses(nextAddresses);

      const pinned = nextAddresses.filter(hasAddressPin);
      const defaultAddress = pinned.find((item) => item.is_default) ?? pinned[0] ?? null;
      const nextMode = (nextCart?.delivery_mode ?? "delivery") as DeliveryMode;
      const nextLocation =
        customerLocation ??
        (defaultAddress ? { latitude: defaultAddress.latitude, longitude: defaultAddress.longitude, source: "address" as const } : null);

      setAddressId((current) => {
        const currentStillUsable = nextAddresses.some((item) => item.id === current && hasAddressPin(item));
        return currentStillUsable ? current : defaultAddress?.id ?? null;
      });
      setDeliveryMode(nextMode);
      if (nextLocation && !customerLocation) setCustomerLocation(nextLocation);
      setPaymentSettings(nextCart?.payment_settings ?? null);

      if (nextCart?.store_slug && nextLocation) {
        const store = await fetchStore(nextCart.store_slug, {
          latitude: nextLocation.latitude,
          longitude: nextLocation.longitude,
          deliveryMode: nextMode
        }).catch(() => null);
        if (store?.payment_settings) setPaymentSettings(store.payment_settings);
      }
    } finally {
      setLoading(false);
    }
  }, [customerLocation, refreshCart, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const deliveryEnabled = cart?.delivery_settings?.delivery_enabled ?? true;
  const pickupEnabled = cart?.delivery_settings?.pickup_enabled ?? true;
  const pinnedAddresses = useMemo(() => addresses.filter(hasAddressPin), [addresses]);
  const selectedAddress = useMemo(() => addresses.find((address) => address.id === addressId) ?? null, [addresses, addressId]);

  const paymentOptions = useMemo(() => buildPaymentOptions(paymentSettings), [paymentSettings]);
  const availablePaymentMethods = useMemo(
    () => paymentOptions.filter((option) => option.available).map((option) => option.method),
    [paymentOptions]
  );

  useEffect(() => {
    if (!availablePaymentMethods.length) return;
    if (!availablePaymentMethods.includes(paymentMethod)) {
      setPaymentMethod(availablePaymentMethods[0]);
      return;
    }
    if (!paymentTouched && availablePaymentMethods.includes("mercadopago")) {
      setPaymentMethod("mercadopago");
    }
  }, [availablePaymentMethods, paymentMethod, paymentTouched]);

  async function persistDeliveryMode(nextMode: DeliveryMode, location: CustomerLocation | { latitude: number; longitude: number }) {
    if (!token) return;
    setCart(
      await updateCart(token, nextMode, {
        customer_latitude: location.latitude,
        customer_longitude: location.longitude
      })
    );
  }

  async function selectDeliveryMode(nextMode: DeliveryMode) {
    if (!token) return;
    if (nextMode === "delivery" && !deliveryEnabled) return;
    if (nextMode === "pickup" && !pickupEnabled) return;

    const previousMode = deliveryMode;
    setDeliveryMode(nextMode);

    const nextLocation =
      nextMode === "delivery" && hasAddressPin(selectedAddress)
        ? { latitude: selectedAddress.latitude, longitude: selectedAddress.longitude, source: "address" as const }
        : customerLocation;

    if (!nextLocation) return;

    setLoading(true);
    try {
      await persistDeliveryMode(nextMode, nextLocation);
    } catch (error) {
      setDeliveryMode(previousMode);
      showError("Modalidad no disponible", friendlyErrorMessage(error, "El comercio no permite esa modalidad en tu zona."));
    } finally {
      setLoading(false);
    }
  }

  async function handleAddressSelect(address: Address) {
    if (!hasAddressPin(address)) return;
    setAddressId(address.id);
    const nextLocation = { latitude: address.latitude, longitude: address.longitude, source: "address" as const };
    setCustomerLocation(nextLocation);
    if (deliveryMode !== "delivery" || !token) return;

    setLoading(true);
    try {
      await persistDeliveryMode("delivery", nextLocation);
    } catch (error) {
      showError("Direccion fuera de cobertura", friendlyErrorMessage(error, "El comercio no llega a esa direccion."));
    } finally {
      setLoading(false);
    }
  }

  async function requestGpsLocation() {
    setLoading(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        showDialog({
          title: "Permiso requerido",
          message: "Necesitamos permiso de ubicacion para validar la zona del comercio.",
          variant: "warning"
        });
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const nextLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude, source: "gps" as const };
      setCustomerLocation(nextLocation);
      if (deliveryMode === "pickup" && token) {
        await persistDeliveryMode("pickup", nextLocation);
      }
    } catch (error) {
      showError("Ubicacion no disponible", friendlyErrorMessage(error, "No pudimos obtener tu ubicacion."));
    } finally {
      setLoading(false);
    }
  }

  function choosePaymentMethod(option: PaymentOption) {
    if (!option.available) {
      showDialog({
        title: "Medio de pago no disponible",
        message: option.reason ?? "El comercio no tiene este medio de pago habilitado.",
        variant: "info"
      });
      return;
    }
    setPaymentTouched(true);
    setPaymentMethod(option.method);
  }

  async function handleCheckout() {
    if (!token || !cart?.store_id) return;
    const selectedAddressForCheckout = addresses.find((address) => address.id === addressId) ?? null;

    if (deliveryMode === "delivery") {
      if (!pinnedAddresses.length) {
        showDialog({
          title: "Direccion requerida",
          message: "Agrega una direccion con pin desde Perfil antes de confirmar un pedido.",
          variant: "warning",
          actions: [
            { label: "Cancelar", variant: "ghost" },
            { label: "Ir a perfil", onPress: () => navigation.navigate("CustomerTabs", { screen: "Profile" }) }
          ]
        });
        return;
      }
      if (!selectedAddressForCheckout) {
        showDialog({ title: "Direccion requerida", message: "Selecciona una direccion antes de confirmar el pedido.", variant: "warning" });
        return;
      }
      if (!hasAddressPin(selectedAddressForCheckout)) {
        showDialog({
          title: "Falta ubicacion",
          message: "La direccion elegida no tiene pin en el mapa. Editala desde Perfil y guarda la ubicacion.",
          variant: "warning"
        });
        return;
      }
    }

    if (deliveryMode === "pickup" && !customerLocation) {
      showDialog({
        title: "Ubicacion requerida",
        message: "Usa GPS o una direccion con pin para validar la zona de retiro.",
        variant: "warning"
      });
      return;
    }

    if (!availablePaymentMethods.length) {
      showDialog({
        title: "Sin medios de pago",
        message: "El comercio no tiene medios de pago disponibles en este momento.",
        variant: "warning"
      });
      return;
    }

    if (!availablePaymentMethods.includes(paymentMethod)) {
      showDialog({
        title: "Medio de pago requerido",
        message: "Selecciona un medio de pago disponible para continuar.",
        variant: "warning"
      });
      return;
    }

    setLoading(true);
    try {
      const coverageLocation =
        deliveryMode === "delivery" && hasAddressPin(selectedAddressForCheckout)
          ? { latitude: selectedAddressForCheckout.latitude, longitude: selectedAddressForCheckout.longitude }
          : customerLocation;
      const result = await checkout(token, {
        store_id: cart.store_id,
        address_id: deliveryMode === "delivery" ? addressId : null,
        delivery_mode: deliveryMode,
        payment_method: paymentMethod,
        idempotency_key: makeIdempotencyKey(),
        customer_latitude: coverageLocation?.latitude ?? null,
        customer_longitude: coverageLocation?.longitude ?? null,
        client_return_url: paymentMethod === "mercadopago" ? MERCADOPAGO_RETURN_URL : null
      });
      await refreshCart({ silent: true }).catch(() => null);
      if (result.checkout_url) {
        if (isMercadoPagoHostedCheckout(result.checkout_url)) {
          const opened = await openHostedMercadoPagoCheckout(result.checkout_url);
          if (opened) {
            navigation.replace("OrderDetail", { orderId: result.order_id });
            return;
          }
        }
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
        <StateMessage title="Carrito vacio" description="Agrega productos antes de confirmar el pedido." actionLabel="Ir al catalogo" onAction={() => navigation.navigate("CustomerTabs", { screen: "Catalog" })} />
      </Screen>
    );
  }

  const commercialDiscount = cart.pricing.commercial_discount_total;
  const financialDiscount = cart.pricing.financial_discount_total;
  const productsTotal = Math.max(0, cart.pricing.subtotal - commercialDiscount - financialDiscount);
  const deliveryFee = deliveryMode === "delivery" ? cart.pricing.delivery_fee : 0;
  const serviceFee = cart.pricing.service_fee;
  const checkoutTotal = productsTotal + deliveryFee + serviceFee;
  const selectedPaymentOption = paymentOptions.find((option) => option.method === paymentMethod);
  const canSubmit = availablePaymentMethods.length > 0;

  return (
    <Screen refreshing={loading} onRefresh={() => void load()}>
      <SectionHeader size="large" title="Checkout" description={cart.store_name ?? undefined} />

      <Card style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.title}>Entrega</Text>
        </View>
        <View style={styles.choiceGrid}>
          <ChoiceButton
            icon="bicycle-outline"
            title="Envio"
            description={deliveryEnabled ? formatCurrency(cart.pricing.delivery_fee) : "No disponible"}
            active={deliveryMode === "delivery"}
            disabled={!deliveryEnabled || loading}
            onPress={() => void selectDeliveryMode("delivery")}
          />
          <ChoiceButton
            icon="storefront-outline"
            title="Retiro"
            description={pickupEnabled ? "Sin costo de envio" : "No disponible"}
            active={deliveryMode === "pickup"}
            disabled={!pickupEnabled || loading}
            onPress={() => void selectDeliveryMode("pickup")}
          />
        </View>
      </Card>

      {deliveryMode === "delivery" ? (
        <Card style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.title}>Direccion</Text>
          </View>

          {addresses.length ? (
            <View style={styles.stack}>
              {addresses.map((address) => {
                const active = addressId === address.id;
                const hasPin = hasAddressPin(address);
                return (
                  <ChoiceButton
                    key={address.id}
                    icon={hasPin ? "location-outline" : "alert-circle-outline"}
                    title={address.label}
                    description={`${address.street}${hasPin ? "" : " - falta pin de mapa"}`}
                    active={active}
                    disabled={!hasPin || loading}
                    onPress={() => void handleAddressSelect(address)}
                  />
                );
              })}
              {!pinnedAddresses.length ? (
                <StateMessage title="Ubicacion pendiente" description="Para pedir con envio, agrega el pin en el mapa desde Perfil." actionLabel="Ir a perfil" onAction={() => navigation.navigate("CustomerTabs", { screen: "Profile" })} />
              ) : null}
            </View>
          ) : (
            <StateMessage title="Sin direcciones" description="Carga una direccion desde Perfil antes de continuar." actionLabel="Ir a perfil" onAction={() => navigation.navigate("CustomerTabs", { screen: "Profile" })} />
          )}
        </Card>
      ) : (
        <Card style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.title}>Retiro</Text>
            <Ionicons name={customerLocation ? "checkmark-circle" : "navigate-outline"} size={22} color={customerLocation ? colors.success : colors.primary} />
          </View>
          {customerLocation ? (
            <Text style={styles.hint}>{cart.store_name ?? "Comercio"}</Text>
          ) : (
            <StateMessage
              title="Ubicacion requerida"
              description="Usa GPS para validar si podes retirar en este comercio."
              actionLabel="Usar mi ubicacion"
              onAction={() => void requestGpsLocation()}
            />
          )}
        </Card>
      )}

      <Card style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.title}>Pago</Text>
        </View>
        <View style={styles.stack}>
          {paymentOptions.map((option) => (
            <ChoiceButton
              key={option.method}
              icon={option.icon}
              title={option.title}
              description={option.available ? option.description : option.reason ?? "No disponible"}
              active={paymentMethod === option.method && option.available}
              disabled={!option.available || loading}
              onPress={() => choosePaymentMethod(option)}
            />
          ))}
        </View>
      </Card>

      <Card style={[styles.panel, styles.summaryPanel]}>
        <View style={styles.panelHeader}>
          <Text style={styles.title}>Resumen</Text>
        </View>

        <View style={styles.stack}>
          <SummaryRow label="Modalidad" value={deliveryMode === "delivery" ? "Envio" : "Retiro"} />
          {deliveryMode === "delivery" ? <SummaryRow label="Direccion" value={selectedAddress?.street ?? ""} /> : null}
          <SummaryRow label="Pago" value={selectedPaymentOption?.title ?? ""} />
          <View style={styles.divider} />
          <SummaryRow label="Subtotal" value={formatCurrency(cart.pricing.subtotal)} />
          {commercialDiscount > 0 ? <SummaryRow label="Descuentos del comercio" value={`-${formatCurrency(commercialDiscount)}`} tone="success" /> : null}
          {financialDiscount > 0 ? <SummaryRow label="Promociones" value={`-${formatCurrency(financialDiscount)}`} tone="success" /> : null}
          <SummaryRow label={deliveryMode === "delivery" ? "Envio" : "Retiro"} value={deliveryMode === "delivery" ? formatCurrency(deliveryFee) : formatCurrency(0)} />
          <SummaryRow label="Servicio" value={formatCurrency(serviceFee)} />
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total a pagar</Text>
            <Text style={styles.total}>{formatCurrency(checkoutTotal)}</Text>
          </View>
          <AppButton title="Confirmar pedido" icon="checkmark-circle-outline" onPress={() => void handleCheckout()} loading={loading} disabled={!canSubmit} fullWidth />
        </View>
      </Card>
    </Screen>
  );
}

function ChoiceButton({
  icon,
  title,
  description,
  active,
  disabled,
  onPress
}: {
  icon: IconName;
  title: string;
  description?: string;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled: Boolean(disabled) }}
      disabled={disabled}
      hitSlop={4}
      android_ripple={disabled ? undefined : { color: colors.borderStrong }}
      onPress={onPress}
      style={({ pressed }) => [styles.choice, active && styles.choiceActive, disabled && styles.choiceDisabled, pressed && !disabled && styles.pressed]}
    >
      <View style={[styles.choiceIcon, active && styles.choiceIconActive, disabled && styles.choiceIconDisabled]}>
        <Ionicons name={icon} size={20} color={active ? "#FFFFFF" : disabled ? colors.subtleText : colors.primaryDark} />
      </View>
      <View style={styles.choiceBody}>
        <Text style={[styles.choiceTitle, disabled && styles.disabledText]} numberOfLines={1}>
          {title}
        </Text>
        {description ? (
          <Text style={[styles.choiceDescription, active && styles.choiceDescriptionActive, disabled && styles.disabledText]} numberOfLines={2}>
            {description}
          </Text>
        ) : null}
      </View>
      {active ? <Ionicons name="checkmark-circle" size={21} color={colors.primary} /> : null}
    </Pressable>
  );
}

function SummaryRow({ label, value, tone }: { label: string; value: string; tone?: "success" }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, tone === "success" && styles.successText]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radii.lg
  },
  summaryPanel: {
    borderColor: colors.borderStrong
  },
  panelHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md
  },
  title: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900"
  },
  choiceGrid: {
    gap: spacing.sm
  },
  stack: {
    gap: spacing.sm
  },
  choice: {
    minHeight: 64,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  choiceActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  choiceDisabled: {
    backgroundColor: colors.surfaceAlt,
    opacity: opacity.disabled
  },
  choiceIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  choiceIconActive: {
    backgroundColor: colors.primary
  },
  choiceIconDisabled: {
    backgroundColor: colors.border
  },
  choiceBody: {
    flex: 1,
    minWidth: 0,
    gap: 2
  },
  choiceTitle: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900"
  },
  choiceDescription: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700"
  },
  choiceDescriptionActive: {
    color: colors.primaryDark
  },
  disabledText: {
    color: colors.subtleText
  },
  pressed: {
    opacity: opacity.pressed
  },
  hint: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700"
  },
  summaryRow: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  summaryLabel: {
    flex: 1,
    color: colors.mutedText,
    fontWeight: "700"
  },
  summaryValue: {
    color: colors.text,
    fontWeight: "900"
  },
  successText: {
    color: colors.success
  },
  divider: {
    height: 1,
    backgroundColor: colors.border
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  totalLabel: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "900"
  },
  total: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "900"
  },
});
