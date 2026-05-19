import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
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
import type { Address, Cart, StorePaymentSettings } from "../../types/api";
import type { RootStackParamList } from "../../navigation/types";
import { friendlyErrorMessage } from "../../utils/apiMessages";
import { hasAddressPin, locationFromAddress, pickPinnedCustomerAddress } from "../../utils/customerAddressSelection";
import { readStoredSelectedDeliveryAddressId, writeStoredSelectedDeliveryAddressId } from "../../utils/customerAddressStorage";
import { readStoredCustomerLocation, writeStoredCustomerLocation } from "../../utils/customerLocationStorage";
import { formatCurrency, makeIdempotencyKey } from "../../utils/format";
import { paymentMethodLabels } from "../../utils/labels";

type Props = NativeStackScreenProps<RootStackParamList, "Checkout">;
type DeliveryMode = "delivery" | "pickup";
type PaymentMethod = "cash" | "mercadopago";
type CustomerLocation = { latitude: number; longitude: number; source: "address" | "gps" | "route"; addressId?: number };
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

function isApprovedPaymentStatus(value: string | null | undefined) {
  return ["approved", "paid"].includes((value ?? "").toLowerCase());
}

function paymentStatusFromReturnUrl(url: string | null | undefined) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get("payment_result") ?? parsed.searchParams.get("status") ?? parsed.searchParams.get("collection_status");
  } catch {
    return null;
  }
}

async function openHostedMercadoPagoCheckout(checkoutUrl: string) {
  try {
    const result = (await WebBrowser.openAuthSessionAsync(checkoutUrl, MERCADOPAGO_RETURN_URL)) as {
      type?: string;
      url?: string;
    };
    return {
      opened: true,
      approved: result.type === "success" && isApprovedPaymentStatus(paymentStatusFromReturnUrl(result.url))
    };
  } catch {
    try {
      await Linking.openURL(checkoutUrl);
      return { opened: true, approved: false };
    } catch {
      return { opened: false, approved: false };
    }
  }
}

function hashCheckoutSignature(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function buildCheckoutAttemptSignature(cart: Cart, deliveryMode: DeliveryMode, paymentMethod: PaymentMethod, addressId: number | null) {
  const items = cart.items.map((item) => [item.product_id, item.quantity, item.note ?? ""].join(":")).join("|");
  return hashCheckoutSignature(
    JSON.stringify({
      store_id: cart.store_id,
      delivery_mode: deliveryMode,
      address_id: deliveryMode === "delivery" ? addressId : null,
      payment_method: paymentMethod,
      items
    })
  );
}

function readCheckoutIdempotencyKey(keys: Map<string, string>, signature: string, storeId: number) {
  const existing = keys.get(signature);
  if (existing) return existing;
  const next = `checkout_${storeId}_${makeIdempotencyKey()}`;
  keys.set(signature, next);
  return next;
}

function clearCheckoutIdempotencyKey(keys: Map<string, string>, signature: string) {
  keys.delete(signature);
}

export function CheckoutScreen({ navigation }: Props) {
  const { token, user } = useAuth();
  const { showDialog, showError } = useAppFeedback();
  const { cart, refreshCart, setCart } = useCartState();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<StorePaymentSettings | null>(cart?.payment_settings ?? null);
  const [addressId, setAddressId] = useState<number | null>(null);
  const [customerLocation, setCustomerLocation] = useState<CustomerLocation | null>(null);
  const [addressSelectorOpen, setAddressSelectorOpen] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>(cart?.delivery_mode ?? "delivery");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentTouched, setPaymentTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const checkoutKeysRef = useRef(new Map<string, string>());

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [nextCart, nextAddresses, storedAddressId, storedLocation] = await Promise.all([
        refreshCart({ silent: true }),
        fetchAddresses(token),
        readStoredSelectedDeliveryAddressId(user?.id).catch(() => null),
        readStoredCustomerLocation(user?.id).catch(() => null)
      ]);
      setAddresses(nextAddresses);

      const preferredAddress = pickPinnedCustomerAddress(nextAddresses, addressId ?? storedAddressId);
      const cartMode = (nextCart?.delivery_mode ?? "delivery") as DeliveryMode;
      const canUsePickupFallback = nextCart?.delivery_settings?.pickup_enabled ?? true;
      const nextMode = cartMode === "delivery" && !preferredAddress && canUsePickupFallback ? "pickup" : cartMode;
      const preferredAddressLocation = preferredAddress ? locationFromAddress(preferredAddress) : null;
      const fallbackLocation = storedLocation ?? (nextMode === "pickup" ? await readLastKnownCustomerLocation() : null);
      const nextLocation = nextMode === "delivery" ? preferredAddressLocation : customerLocation ?? preferredAddressLocation ?? fallbackLocation;
      let cartForSettings = nextCart;

      setAddressId((current) => {
        const currentStillUsable = nextAddresses.some((item) => item.id === current && hasAddressPin(item));
        return currentStillUsable ? current : preferredAddress?.id ?? null;
      });
      setDeliveryMode(nextMode);
      if (cartMode !== nextMode && nextLocation) {
        cartForSettings = await updateCart(token, nextMode, {
          customer_latitude: nextLocation.latitude,
          customer_longitude: nextLocation.longitude
        }).catch(() => nextCart);
        setCart(cartForSettings);
      }
      if (
        nextLocation &&
        (
          !customerLocation ||
          customerLocation.latitude !== nextLocation.latitude ||
          customerLocation.longitude !== nextLocation.longitude ||
          customerLocation.source !== nextLocation.source ||
          customerLocation.addressId !== nextLocation.addressId
        )
      ) {
        setCustomerLocation(nextLocation);
        void writeStoredCustomerLocation(user?.id, nextLocation);
      }
      if (!nextLocation && customerLocation) setCustomerLocation(null);
      setPaymentSettings(cartForSettings?.payment_settings ?? null);

      if (cartForSettings?.store_slug && nextLocation) {
        const store = await fetchStore(cartForSettings.store_slug, {
          latitude: nextLocation.latitude,
          longitude: nextLocation.longitude,
          deliveryMode: nextMode
        }).catch(() => null);
        if (store?.payment_settings) setPaymentSettings(store.payment_settings);
      }
    } finally {
      setLoading(false);
    }
  }, [addressId, customerLocation, refreshCart, setCart, token, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const deliveryEnabled = cart?.delivery_settings?.delivery_enabled ?? true;
  const pickupEnabled = cart?.delivery_settings?.pickup_enabled ?? true;
  const pinnedAddresses = useMemo(() => addresses.filter(hasAddressPin), [addresses]);
  const selectedAddress = useMemo(() => addresses.find((address) => address.id === addressId) ?? null, [addresses, addressId]);
  const addressOptions = useMemo(
    () => addresses.filter((address) => address.id !== addressId),
    [addresses, addressId]
  );

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
    if (!token) return null;
    const nextCart = await updateCart(token, nextMode, {
      customer_latitude: location.latitude,
      customer_longitude: location.longitude
    });
    setCart(nextCart);
    return nextCart;
  }

  async function refreshPaymentSettingsForLocation(
    nextCart: Cart | null,
    nextMode: DeliveryMode,
    location: CustomerLocation | { latitude: number; longitude: number } | null
  ) {
    if (!nextCart?.store_slug || !location) return;
    const store = await fetchStore(nextCart.store_slug, {
      latitude: location.latitude,
      longitude: location.longitude,
      deliveryMode: nextMode
    }).catch(() => null);
    if (store?.payment_settings) setPaymentSettings(store.payment_settings);
  }

  async function readLastKnownCustomerLocation(): Promise<CustomerLocation | null> {
    const permission = await Location.getForegroundPermissionsAsync().catch(() => null);
    if (permission?.status !== "granted") return null;
    const position = await Location.getLastKnownPositionAsync({ maxAge: 24 * 60 * 60 * 1000 }).catch(() => null);
    if (!position) return null;
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      source: "gps"
    };
  }

  async function resolveReusableCustomerLocation(): Promise<CustomerLocation | null> {
    if (customerLocation) return customerLocation;
    const storedLocation = await readStoredCustomerLocation(user?.id).catch(() => null);
    const nextLocation = storedLocation ?? (await readLastKnownCustomerLocation());
    if (!nextLocation) return null;
    setCustomerLocation(nextLocation);
    void writeStoredCustomerLocation(user?.id, nextLocation);
    return nextLocation;
  }

  async function selectDeliveryMode(nextMode: DeliveryMode) {
    if (!token) return;
    if (nextMode === "delivery" && !deliveryEnabled) return;
    if (nextMode === "pickup" && !pickupEnabled) return;

    const previousMode = deliveryMode;
    if (nextMode === "delivery" && !hasAddressPin(selectedAddress)) {
      showDialog({
        title: "Direccion requerida",
        message: "Para pedir con envio, agrega una direccion nueva con pin desde Perfil.",
        variant: "warning",
        actions: [
          { label: "Cancelar", variant: "ghost" },
          { label: "Ir a perfil", onPress: () => navigation.navigate("CustomerTabs", { screen: "Profile" }) }
        ]
      });
      return;
    }

    setDeliveryMode(nextMode);

    const nextLocation =
      nextMode === "delivery" && hasAddressPin(selectedAddress)
        ? { latitude: selectedAddress.latitude, longitude: selectedAddress.longitude, source: "address" as const }
        : await resolveReusableCustomerLocation();

    if (!nextLocation) return;

    setLoading(true);
    try {
      const nextCart = await persistDeliveryMode(nextMode, nextLocation);
      if (nextMode === "delivery" && hasAddressPin(selectedAddress)) {
        const selectedLocation = locationFromAddress(selectedAddress);
        setAddressId(selectedAddress.id);
        setCustomerLocation(selectedLocation);
        void writeStoredSelectedDeliveryAddressId(user?.id, selectedAddress.id);
        void writeStoredCustomerLocation(user?.id, selectedLocation);
      } else {
        void writeStoredCustomerLocation(user?.id, nextLocation);
      }
      await refreshPaymentSettingsForLocation(nextCart, nextMode, nextLocation);
    } catch (error) {
      setDeliveryMode(previousMode);
      showError("Modalidad no disponible", friendlyErrorMessage(error, "El comercio no permite esa modalidad en tu zona."));
    } finally {
      setLoading(false);
    }
  }

  async function handleAddressSelect(address: Address) {
    if (!hasAddressPin(address) || loading) return;
    const nextLocation = locationFromAddress(address);

    setLoading(true);
    try {
      const nextCart = deliveryMode === "delivery" ? await persistDeliveryMode("delivery", nextLocation) : null;
      setAddressId(address.id);
      setCustomerLocation(nextLocation);
      setAddressSelectorOpen(false);
      void writeStoredSelectedDeliveryAddressId(user?.id, address.id);
      void writeStoredCustomerLocation(user?.id, nextLocation);
      await refreshPaymentSettingsForLocation(nextCart, deliveryMode, nextLocation);
    } catch (error) {
      showError("Direccion fuera de cobertura", friendlyErrorMessage(error, "El comercio no llega a esa direccion."));
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

    const pickupCheckoutLocation = deliveryMode === "pickup" ? await resolveReusableCustomerLocation() : null;
    if (deliveryMode === "pickup" && !pickupCheckoutLocation) {
      showError(
        "Ubicacion no disponible",
        "No pudimos recuperar la ubicacion usada para validar este comercio. Volve al catalogo e intentalo nuevamente."
      );
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
    const checkoutAttemptSignature = buildCheckoutAttemptSignature(cart, deliveryMode, paymentMethod, addressId);
    const idempotencyKey = readCheckoutIdempotencyKey(checkoutKeysRef.current, checkoutAttemptSignature, cart.store_id);
    try {
      const coverageLocation =
        deliveryMode === "delivery" && hasAddressPin(selectedAddressForCheckout)
          ? { latitude: selectedAddressForCheckout.latitude, longitude: selectedAddressForCheckout.longitude }
          : pickupCheckoutLocation;
      const result = await checkout(token, {
        store_id: cart.store_id,
        address_id: deliveryMode === "delivery" ? addressId : null,
        delivery_mode: deliveryMode,
        payment_method: paymentMethod,
        idempotency_key: idempotencyKey,
        customer_latitude: coverageLocation?.latitude ?? null,
        customer_longitude: coverageLocation?.longitude ?? null,
        client_return_url: paymentMethod === "mercadopago" ? MERCADOPAGO_RETURN_URL : null
      });
      await refreshCart({ silent: true }).catch(() => null);
      if (result.checkout_url) {
        if (isMercadoPagoHostedCheckout(result.checkout_url)) {
          const hostedResult = await openHostedMercadoPagoCheckout(result.checkout_url);
          await refreshCart({ silent: true }).catch(() => null);
          if (!hostedResult.opened) {
            showError("No se pudo abrir Mercado Pago", "Toca Ir a pagar para volver a intentarlo.");
            return;
          }
          if (hostedResult.approved) {
            clearCheckoutIdempotencyKey(checkoutKeysRef.current, checkoutAttemptSignature);
            navigation.replace("OrderDetail", { orderId: result.order_id });
          }
          return;
        }
        navigation.navigate("PaymentWebView", { checkoutUrl: result.checkout_url, orderId: result.order_id });
      } else {
        clearCheckoutIdempotencyKey(checkoutKeysRef.current, checkoutAttemptSignature);
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
  const checkoutActionTitle = paymentMethod === "mercadopago" ? "Ir a pagar" : "Confirmar pedido";
  const deliveryNeedsAddress = !pinnedAddresses.length;

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
            description={!deliveryEnabled ? "No disponible" : deliveryNeedsAddress ? "Agrega una direccion" : formatCurrency(cart.pricing.delivery_fee)}
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
              {selectedAddress && hasAddressPin(selectedAddress) ? (
                <ChoiceButton
                  icon="location-outline"
                  title={selectedAddress.label || "Direccion"}
                  description={`${selectedAddress.street} - ${selectedAddress.locality}`}
                  active
                  disabled={loading}
                  onPress={() => setAddressSelectorOpen((current) => !current)}
                />
              ) : null}
              {pinnedAddresses.length ? (
                <AppButton
                  title={addressSelectorOpen ? "Ocultar direcciones" : "Cambiar direccion"}
                  icon={addressSelectorOpen ? "chevron-up-outline" : "swap-horizontal-outline"}
                  variant="ghost"
                  disabled={loading}
                  fullWidth
                  onPress={() => setAddressSelectorOpen((current) => !current)}
                />
              ) : null}
              {addressSelectorOpen ? (
                <View style={styles.addressOptions}>
                  {addressOptions.length ? (
                    addressOptions.map((address) => {
                      const hasPin = hasAddressPin(address);
                      return (
                        <ChoiceButton
                          key={address.id}
                          icon={hasPin ? "location-outline" : "alert-circle-outline"}
                          title={address.label || "Direccion"}
                          description={`${address.street}${hasPin ? ` - ${address.locality}` : " - falta pin de mapa"}`}
                          active={false}
                          disabled={!hasPin || loading}
                          onPress={() => void handleAddressSelect(address)}
                        />
                      );
                    })
                  ) : (
                    <Text style={styles.hint}>No hay otras direcciones cargadas.</Text>
                  )}
                </View>
              ) : null}
              {!pinnedAddresses.length ? (
                <StateMessage title="Direccion pendiente" description="Para pedir con envio, agrega una direccion nueva con pin desde Perfil." actionLabel="Ir a perfil" onAction={() => navigation.navigate("CustomerTabs", { screen: "Profile" })} />
              ) : null}
            </View>
          ) : (
            <StateMessage title="Sin direcciones" description="Carga una direccion nueva desde Perfil para habilitar envio." actionLabel="Ir a perfil" onAction={() => navigation.navigate("CustomerTabs", { screen: "Profile" })} />
          )}
        </Card>
      ) : (
        <Card style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.title}>Retiro</Text>
            <Ionicons name="checkmark-circle" size={22} color={colors.success} />
          </View>
          <View style={styles.pickupInfo}>
            <Text style={styles.pickupTitle}>{cart.store_name ?? "Comercio"}</Text>
            <Text style={styles.hint}>
              {customerLocation
                ? "Usamos la ubicacion que ya validaste para este pedido."
                : "Retiro habilitado. Vamos a reutilizar la ubicacion validada al confirmar."}
            </Text>
          </View>
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
          <AppButton
            title={checkoutActionTitle}
            icon={paymentMethod === "mercadopago" ? "wallet-outline" : "checkmark-circle-outline"}
            onPress={() => void handleCheckout()}
            loading={loading}
            disabled={!canSubmit}
            fullWidth
          />
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
  addressOptions: {
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
  pickupInfo: {
    gap: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.primarySoft,
    padding: spacing.md
  },
  pickupTitle: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900"
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
