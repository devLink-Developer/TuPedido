import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppButton } from "../../components/AppButton";
import { Card } from "../../components/Card";
import { MapPreview } from "../../components/MapPreview";
import { Screen } from "../../components/Screen";
import { StateMessage } from "../../components/StateMessage";
import { useAsyncLoad } from "../../hooks/useAsyncLoad";
import { useOrderRealtime } from "../../hooks/useOrderRealtime";
import { fetchDirections, fetchOrder, fetchOrderPayment, fetchOrderTracking } from "../../services/api";
import { useAppFeedback } from "../../state/AppFeedbackContext";
import { useAuth } from "../../state/AuthContext";
import { useCartState } from "../../state/CartContext";
import { useOrderReviewPrompt } from "../../state/OrderReviewPromptContext";
import { colors, opacity, radii, shadow, spacing, touchTarget, typography } from "../../theme";
import type { DirectionsRead, Order, OrderTracking, RouteCoordinate, RouteProfile } from "../../types/api";
import type { RootStackParamList } from "../../navigation/types";
import { friendlyErrorMessage } from "../../utils/apiMessages";
import { formatCurrency, formatDateTime } from "../../utils/format";
import { labelForStatus, paymentMethodLabels } from "../../utils/labels";
import { repeatOrderFeedback, repeatOrderIntoCart } from "../../utils/repeatOrder";

type Props = NativeStackScreenProps<RootStackParamList, "OrderDetail">;
const REVIEW_PROMPT_DELAY_MS = 10 * 60 * 1000;

function toRouteCoordinate(latitude: number | null | undefined, longitude: number | null | undefined): RouteCoordinate | null {
  if (typeof latitude !== "number" || typeof longitude !== "number") return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function routeProfileForVehicle(vehicle: string | null | undefined): RouteProfile {
  if (vehicle === "bicycle") return "cycling-regular";
  return "driving-car";
}

function statusTone(status: string) {
  if (status === "delivered") return { wrap: styles.statusSuccess, text: styles.statusSuccessText, icon: colors.success };
  if (["cancelled", "delivery_failed"].includes(status)) return { wrap: styles.statusDanger, text: styles.statusDangerText, icon: colors.danger };
  return { wrap: styles.statusActive, text: styles.statusActiveText, icon: colors.primaryDark };
}

function itemCountLabel(order: Order) {
  const count = order.items.reduce((total, item) => total + item.quantity, 0);
  return count === 1 ? "1 producto" : `${count} productos`;
}

export function OrderDetailScreen({ route, navigation }: Props) {
  const { orderId } = route.params;
  const { token } = useAuth();
  const { showDialog, showError } = useAppFeedback();
  const { setCart } = useCartState();
  const { openReviewPrompt } = useOrderReviewPrompt();
  const [tracking, setTracking] = useState<OrderTracking | null>(null);
  const [directions, setDirections] = useState<DirectionsRead | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [repeating, setRepeating] = useState(false);
  const {
    data: order,
    setData: setOrder,
    loading,
    error,
    reload
  } = useAsyncLoad<Order>(
    async () => {
      if (!token) throw new Error("Sesion no disponible");
      const [nextOrder, nextTracking] = await Promise.all([
        fetchOrder(token, orderId),
        fetchOrderTracking(token, orderId).catch(() => null)
      ]);
      setTracking(nextTracking);
      return nextOrder;
    },
    [orderId, token]
  );

  const pollCurrentOrder = useCallback(async () => {
    if (!token) return null;
    return fetchOrder(token, orderId);
  }, [orderId, token]);

  useOrderRealtime({
    token,
    orderId,
    enabled: Boolean(order && !["delivered", "cancelled", "delivery_failed"].includes(order.status)),
    onOrder: setOrder,
    onTracking: setTracking,
    onError: setLiveError,
    pollOrder: pollCurrentOrder
  });

  useEffect(() => {
    if (!token || !order || order.delivery_mode !== "delivery") {
      setDirections(null);
      return;
    }

    const destination = toRouteCoordinate(order.address_latitude, order.address_longitude);
    const rider = toRouteCoordinate(
      tracking?.tracking_last_latitude ?? order.tracking_last_latitude,
      tracking?.tracking_last_longitude ?? order.tracking_last_longitude
    );
    const store = toRouteCoordinate(order.store_latitude, order.store_longitude);
    const origin = rider ?? store;
    if (!origin || !destination) {
      setDirections(null);
      return;
    }

    let active = true;
    void fetchDirections(token, {
      profile: routeProfileForVehicle(tracking?.assigned_rider_vehicle_type ?? order.assigned_rider_vehicle_type),
      coordinates: [origin, destination]
    })
      .then((nextDirections) => {
        if (active) setDirections(nextDirections);
      })
      .catch(() => {
        if (active) setDirections(null);
      });

    return () => {
      active = false;
    };
  }, [
    order,
    token,
    tracking?.assigned_rider_vehicle_type,
    tracking?.tracking_last_latitude,
    tracking?.tracking_last_longitude
  ]);

  const refreshPayment = useCallback(async () => {
    if (!token) return;
    try {
      const payment = await fetchOrderPayment(token, orderId);
      showDialog({ title: "Pago", message: `Estado: ${payment.status}`, variant: "info" });
      await reload();
    } catch (paymentError) {
      showError("Pago no disponible", friendlyErrorMessage(paymentError));
    }
  }, [orderId, reload, showDialog, showError, token]);

  function openOrderReview() {
    if (!order) return;
    openReviewPrompt({
      order_id: order.id,
      store_name: order.store_name,
      delivered_at: order.delivered_at,
      rider_name: order.assigned_rider_name,
      requires_rider_rating: Boolean(order.assigned_rider_id)
    });
  }

  function openHelp() {
    showDialog({
      title: "Ayuda con tu pedido",
      message: "Si necesitas modificar o consultar el pedido, contacta al comercio desde los datos de entrega.",
      variant: "info"
    });
  }

  async function repeatCurrentOrder() {
    if (!order || !token) return;

    setRepeating(true);
    try {
      const result = await repeatOrderIntoCart(token, order);
      if (result.cart) {
        setCart(result.cart);
      }
      const feedback = repeatOrderFeedback(result);
      showDialog({
        ...feedback,
        actions:
          result.addedItemCount > 0
            ? [
                { label: "Seguir", variant: "ghost" },
                { label: "Ver carrito", onPress: () => navigation.navigate("Cart") }
              ]
            : undefined
      });
    } finally {
      setRepeating(false);
    }
  }

  if (loading && !order) {
    return <StateMessage title="Cargando pedido" loading />;
  }
  if (error || !order) {
    return <StateMessage title="Pedido no disponible" description={error ?? undefined} actionLabel="Reintentar" onAction={() => void reload()} />;
  }

  const deliveryCodeRequired = Boolean(tracking?.otp_required ?? order.otp_required);
  const deliveryCode = tracking?.otp_code ?? null;
  const deliveryModeLabel = order.delivery_mode === "delivery" ? "Envio a domicilio" : "Retiro en tienda";
  const deliveryAddress = order.address_full ?? order.address_label ?? "No disponible";
  const eta = tracking?.eta_minutes ?? directions?.duration_minutes ?? order.eta_minutes;
  const tone = statusTone(order.status);

  return (
    <Screen refreshing={loading} onRefresh={() => void reload()} contentContainerStyle={styles.screenContent}>
      <View style={styles.hero}>
        <View style={styles.heroActions}>
          <HeaderIconButton icon="chevron-back" label="Volver" onPress={() => navigation.goBack()} />
          <HeaderIconButton icon="help-circle-outline" label="Ayuda" onPress={openHelp} />
        </View>
        <View style={[styles.statusPill, tone.wrap]}>
          <Ionicons name="checkmark-circle" size={17} color={tone.icon} />
          <Text style={[styles.statusText, tone.text]}>{labelForStatus(order.status)}</Text>
        </View>
        <Text style={styles.heroEyebrow}>Pedido #{order.id}</Text>
        <Text style={styles.heroTitle} numberOfLines={2}>
          {order.store_name}
        </Text>
        <View style={styles.heroMetaRow}>
          <Text style={styles.heroMeta}>{formatDateTime(order.created_at)}</Text>
          <Text style={styles.heroDot}>•</Text>
          <Text style={styles.heroMeta}>{itemCountLabel(order)}</Text>
        </View>
        <Text style={styles.heroTotal}>{formatCurrency(order.total)}</Text>
      </View>

      {liveError ? <Text style={styles.liveError}>{liveError}</Text> : null}

      <Card style={styles.storeCard}>
        <View style={styles.storeIcon}>
          <Ionicons name="storefront-outline" size={24} color={colors.primaryDark} />
        </View>
        <View style={styles.storeCopy}>
          <Text style={styles.kicker}>Tienda</Text>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {order.store_name}
          </Text>
          <Text style={styles.meta}>{deliveryModeLabel}</Text>
        </View>
        <AppButton title={repeating ? "Actualizando" : "Repetir"} icon="refresh-outline" onPress={() => void repeatCurrentOrder()} loading={repeating} />
      </Card>

      {deliveryCodeRequired ? (
        <Card style={[styles.card, styles.deliveryCodeCard]}>
          <Text style={styles.kicker}>Codigo de entrega</Text>
          <Text style={styles.deliveryCodeTitle}>Mostraselo al repartidor al recibir el pedido.</Text>
          {deliveryCode ? (
            <Text selectable maxFontSizeMultiplier={1.15} style={styles.deliveryCodeValue}>
              {deliveryCode}
            </Text>
          ) : (
            <Text style={styles.deliveryCodePending}>El codigo aparecera cuando el seguimiento este activo.</Text>
          )}
        </Card>
      ) : null}

      <DetailSection title="Productos" icon="bag-handle-outline">
        {order.items.map((item) => (
          <View key={item.id} style={styles.productLine}>
            <View style={styles.productQty}>
              <Text style={styles.productQtyText}>{item.quantity}x</Text>
            </View>
            <View style={styles.productCopy}>
              <Text style={styles.productName}>{item.product_name}</Text>
              {item.note ? <Text style={styles.productNote}>{item.note}</Text> : null}
            </View>
            <Text style={styles.lineTotal}>{formatCurrency(item.unit_price * item.quantity)}</Text>
          </View>
        ))}
        <View style={styles.sectionDivider} />
        <SummaryRow label="Total" value={formatCurrency(order.total)} strong />
      </DetailSection>

      <DetailSection title="Tu pago" icon="wallet-outline">
        <SummaryRow label="Subtotal" value={formatCurrency(order.subtotal)} />
        {order.commercial_discount_total > 0 ? <SummaryRow label="Descuentos" value={`-${formatCurrency(order.commercial_discount_total)}`} /> : null}
        {order.delivery_fee_customer > 0 ? <SummaryRow label="Envio" value={formatCurrency(order.delivery_fee_customer)} /> : null}
        {order.service_fee > 0 ? <SummaryRow label="Servicio" value={formatCurrency(order.service_fee)} /> : null}
        <View style={styles.sectionDivider} />
        <SummaryRow label="Total pagado" value={formatCurrency(order.total)} strong />
      </DetailSection>

      <DetailSection title="Medios de pago" icon="card-outline">
        <InfoRow label="Metodo" value={paymentMethodLabels[order.payment_method] ?? order.payment_method} />
        <InfoRow label="Estado" value={labelForStatus(order.payment_status)} />
        {order.payment_reference ? <InfoRow label="Referencia" value={order.payment_reference} /> : null}
        {order.payment_method === "mercadopago" ? <AppButton title="Actualizar pago" icon="refresh-outline" onPress={() => void refreshPayment()} variant="ghost" fullWidth /> : null}
      </DetailSection>

      <DetailSection title="Detalles sobre la entrega" icon={order.delivery_mode === "delivery" ? "bicycle-outline" : "walk-outline"}>
        <InfoRow label="Modalidad" value={deliveryModeLabel} />
        <InfoRow label="Estado" value={labelForStatus(order.delivery_status)} />
        <InfoRow label="Direccion" value={deliveryAddress} />
        <InfoRow label="Repartidor" value={tracking?.assigned_rider_name ?? order.assigned_rider_name ?? "Sin asignar"} />
        <InfoRow label="Telefono" value={tracking?.assigned_rider_phone_masked ?? order.assigned_rider_phone_masked ?? "No disponible"} />
        <InfoRow label="Tiempo estimado" value={eta ? `${eta} min` : "-"} />
      </DetailSection>

      {order.delivery_mode === "delivery" ? (
        <MapPreview
          route={
            directions
              ? {
                  geometry: directions.geometry,
                  distanceMeters: directions.distance_meters,
                  durationMinutes: directions.duration_minutes
                }
              : null
          }
          points={[
            { id: "store", label: "Comercio", latitude: order.store_latitude, longitude: order.store_longitude, color: colors.primary },
            {
              id: "rider",
              label: "Repartidor",
              latitude: tracking?.tracking_last_latitude ?? order.tracking_last_latitude,
              longitude: tracking?.tracking_last_longitude ?? order.tracking_last_longitude,
              color: colors.accent
            },
            { id: "address", label: "Destino", latitude: order.address_latitude, longitude: order.address_longitude, color: colors.success }
          ]}
          pointMeta={{
            store: order.store_name,
            rider: tracking?.assigned_rider_name ?? order.assigned_rider_name ?? "Repartidor asignado",
            address: deliveryAddress
          }}
        />
      ) : null}

      {order.status === "delivered" ? (
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Calificar experiencia</Text>
          <Text style={styles.meta}>La solicitud se habilita 10 minutos despues de recibir el pedido para que puedas revisarlo con calma.</Text>
          <AppButton
            title="Calificar ahora"
            icon="star-outline"
            onPress={openOrderReview}
            disabled={!order.delivered_at || Date.now() - new Date(order.delivered_at).getTime() < REVIEW_PROMPT_DELAY_MS}
          />
        </Card>
      ) : null}

      <AppButton title="Volver a pedidos" icon="receipt-outline" onPress={() => navigation.navigate("CustomerTabs", { screen: "Orders" })} variant="ghost" fullWidth />
    </Screen>
  );
}

function HeaderIconButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      android_ripple={{ color: colors.borderStrong }}
      style={({ pressed }) => [styles.headerIconButton, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={23} color={colors.text} />
    </Pressable>
  );
}

function DetailSection({ title, icon, children }: { title: string; icon: keyof typeof Ionicons.glyphMap; children: ReactNode }) {
  return (
    <Card style={styles.card}>
      <View style={styles.sectionHeading}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} size={19} color={colors.primaryDark} />
        </View>
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      {children}
    </Card>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, strong && styles.summaryStrong]}>{label}</Text>
      <Text style={[styles.summaryValue, strong && styles.summaryStrong]}>{value}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    gap: spacing.md
  },
  hero: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.primarySoft,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.medium
  },
  heroActions: {
    minHeight: touchTarget.min,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  headerIconButton: {
    width: touchTarget.min,
    height: touchTarget.min,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  statusPill: {
    alignSelf: "flex-start",
    minHeight: 34,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  statusSuccess: {
    backgroundColor: colors.successSoft
  },
  statusSuccessText: {
    color: colors.success
  },
  statusDanger: {
    backgroundColor: colors.dangerSoft
  },
  statusDangerText: {
    color: colors.danger
  },
  statusActive: {
    backgroundColor: colors.surface
  },
  statusActiveText: {
    color: colors.primaryDark
  },
  statusText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900"
  },
  heroEyebrow: {
    color: colors.primaryDark,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  heroTitle: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900"
  },
  heroMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  heroMeta: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700"
  },
  heroDot: {
    color: colors.subtleText,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900"
  },
  heroTotal: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900"
  },
  liveError: {
    color: colors.warning,
    fontWeight: "800"
  },
  card: {
    gap: spacing.md
  },
  storeCard: {
    minHeight: 84,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  storeIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  storeCopy: {
    flex: 1,
    minWidth: 0
  },
  kicker: {
    color: colors.primaryDark,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900"
  },
  meta: {
    color: colors.mutedText,
    lineHeight: 20
  },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  deliveryCodeCard: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  deliveryCodeTitle: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "800"
  },
  deliveryCodeValue: {
    color: colors.primaryDark,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: 6,
    fontWeight: "900",
    textAlign: "center"
  },
  deliveryCodePending: {
    color: colors.warning,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800"
  },
  productLine: {
    minHeight: touchTarget.min,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  productQty: {
    minWidth: 36,
    minHeight: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center"
  },
  productQtyText: {
    color: colors.primaryDark,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900"
  },
  productCopy: {
    flex: 1,
    minWidth: 0
  },
  productName: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800"
  },
  productNote: {
    color: colors.mutedText,
    ...typography.caption
  },
  lineTotal: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "900",
    maxWidth: "34%",
    textAlign: "right"
  },
  sectionDivider: {
    height: 1,
    backgroundColor: colors.border
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
    fontSize: 14,
    lineHeight: 20
  },
  summaryValue: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    textAlign: "right"
  },
  summaryStrong: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900"
  },
  infoRow: {
    minHeight: 32,
    gap: spacing.xs
  },
  infoLabel: {
    color: colors.mutedText,
    ...typography.label
  },
  infoValue: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800"
  },
  pressed: {
    opacity: opacity.pressed
  }
});
