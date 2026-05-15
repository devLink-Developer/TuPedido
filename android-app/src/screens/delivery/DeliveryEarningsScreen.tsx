import { Ionicons } from "@expo/vector-icons";
import { useCallback, useMemo, useState, type ComponentProps } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "@react-navigation/native";
import { AppButton } from "../../components/AppButton";
import { Card } from "../../components/Card";
import { Screen } from "../../components/Screen";
import { SectionHeader } from "../../components/SectionHeader";
import { StateMessage } from "../../components/StateMessage";
import { confirmDeliverySettlementPayment, disputeDeliverySettlementPayment, fetchDeliverySettlementPayments, fetchDeliverySettlements } from "../../services/api";
import { useAppFeedback } from "../../state/AppFeedbackContext";
import { useAuth } from "../../state/AuthContext";
import { colors, opacity, radii, shadow, spacing } from "../../theme";
import type { DeliverySettlement, DeliverySettlementPayment } from "../../types/api";
import type { DeliveryTabsParamList } from "../../navigation/types";
import { friendlyErrorMessage } from "../../utils/apiMessages";
import { formatCurrency, formatDateTime } from "../../utils/format";

type Props = BottomTabScreenProps<DeliveryTabsParamList, "DeliveryEarnings">;
type IconName = ComponentProps<typeof Ionicons>["name"];

function paymentStatusLabel(status: string) {
  if (status === "pending_confirmation") return "Por confirmar";
  if (status === "confirmed") return "Recibido";
  if (status === "disputed") return "En revisión";
  return status.replace(/[_-]+/g, " ");
}

function paymentStatusTone(status: string) {
  if (status === "confirmed") return "success";
  if (status === "disputed") return "warning";
  return "primary";
}

export function DeliveryEarningsScreen(_props: Props) {
  const { token } = useAuth();
  const { showError } = useAppFeedback();
  const [settlement, setSettlement] = useState<DeliverySettlement | null>(null);
  const [payments, setPayments] = useState<DeliverySettlementPayment[]>([]);
  const [respondingPaymentId, setRespondingPaymentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [nextSettlement, nextPayments] = await Promise.all([
        fetchDeliverySettlements(token),
        fetchDeliverySettlementPayments(token)
      ]);
      setSettlement(nextSettlement);
      setPayments(nextPayments);
    } catch (loadError) {
      setError(friendlyErrorMessage(loadError, "No se pudieron cargar tus ganancias"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const pendingPayments = useMemo(
    () => payments.filter((payment) => payment.receiver_status === "pending_confirmation"),
    [payments]
  );

  async function respond(paymentId: number, response: "confirm" | "dispute") {
    if (!token || respondingPaymentId) return;
    setRespondingPaymentId(paymentId);
    try {
      const updated =
        response === "confirm"
          ? await confirmDeliverySettlementPayment(token, paymentId, "Recibido correctamente")
          : await disputeDeliverySettlementPayment(token, paymentId, "Diferencia reportada desde app móvil");
      setPayments((current) => current.map((item) => (item.id === paymentId ? updated : item)));
    } catch (responseError) {
      showError("No se pudo responder", friendlyErrorMessage(responseError));
    } finally {
      setRespondingPaymentId(null);
    }
  }

  return (
    <Screen noScroll>
      <FlatList
        data={payments}
        keyExtractor={(item) => String(item.id)}
        refreshing={loading}
        onRefresh={() => void load()}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <SectionHeader size="large" title="Ganancias" description={error ?? "Pagos, saldos y efectivo a rendir."} />
            {settlement ? (
              <>
                <Card style={styles.hero}>
                  <View style={styles.heroTop}>
                    <View style={styles.heroIcon}>
                      <Ionicons name="wallet-outline" size={24} color="#FFFFFF" />
                    </View>
                    <View style={styles.heroCopy}>
                      <Text style={styles.heroLabel}>Disponible para cobrar</Text>
                      <Text style={styles.heroValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>
                        {formatCurrency(settlement.pending_amount)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.heroStats}>
                    <MiniTotal label="Ganado" value={formatCurrency(settlement.rider_fee_earned_total)} />
                    <MiniTotal label="Pagado" value={formatCurrency(settlement.rider_fee_paid_total)} />
                  </View>
                </Card>
                <View style={styles.summaryGrid}>
                  <MetricCard icon="receipt-outline" label="Pagos a confirmar" value={String(pendingPayments.length)} tone="primary" />
                  <MetricCard icon="cash-outline" label="Efectivo a rendir" value={formatCurrency(settlement.cash_liability_open)} tone="warning" />
                  <MetricCard icon="business-outline" label="A comercio" value={formatCurrency(settlement.merchant_cash_payable_total)} tone="neutral" />
                  <MetricCard icon="checkmark-done-outline" label="Ya pagado" value={formatCurrency(settlement.rider_fee_paid_total)} tone="success" />
                </View>
              </>
            ) : null}
          </View>
        }
        ListEmptyComponent={!loading ? <StateMessage title="Sin pagos" description="Cuando haya pagos para revisar aparecerán acá." /> : null}
        renderItem={({ item }) => {
          const tone = paymentStatusTone(item.receiver_status);
          const responding = respondingPaymentId === item.id;
          return (
            <Card style={styles.payment}>
              <View style={styles.paymentTop}>
                <View style={styles.paymentTitleWrap}>
                  <Text style={styles.paymentAmount}>{formatCurrency(item.amount)}</Text>
                  <Text style={styles.paymentMeta}>{item.store_name ?? "KePedimos"} · {formatDateTime(item.created_at)}</Text>
                </View>
                <View style={[styles.statusPill, styles[`${tone}Pill`]]}>
                  <Text style={[styles.statusText, styles[`${tone}Text`]]}>{paymentStatusLabel(item.receiver_status)}</Text>
                </View>
              </View>

              {item.reference ? <InfoLine icon="document-text-outline" label="Referencia" value={item.reference} /> : null}
              {item.notes ? <InfoLine icon="chatbox-ellipses-outline" label="Nota" value={item.notes} /> : null}
              {item.paid_at ? <InfoLine icon="calendar-outline" label="Pagado" value={formatDateTime(item.paid_at)} /> : null}

              {item.receiver_status === "pending_confirmation" ? (
                <View style={styles.actions}>
                  <AppButton
                    title="Recibido"
                    icon="checkmark-circle-outline"
                    loading={responding}
                    disabled={respondingPaymentId !== null && !responding}
                    onPress={() => void respond(item.id, "confirm")}
                    fullWidth
                  />
                  <AppButton
                    title="Reportar diferencia"
                    icon="alert-circle-outline"
                    disabled={respondingPaymentId !== null}
                    onPress={() => void respond(item.id, "dispute")}
                    variant="ghost"
                    fullWidth
                  />
                </View>
              ) : null}
            </Card>
          );
        }}
      />
    </Screen>
  );
}

function MiniTotal({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniTotal}>
      <Text style={styles.miniValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

function MetricCard({ icon, label, value, tone }: { icon: IconName; label: string; value: string; tone: "primary" | "success" | "warning" | "neutral" }) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, styles[`${tone}Icon`]]}>
        <Ionicons name={icon} size={18} color={tone === "success" ? colors.success : tone === "warning" ? colors.warning : tone === "neutral" ? colors.text : colors.primary} />
      </View>
      <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>{value}</Text>
      <Text style={styles.metricLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function InfoLine({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={styles.infoLine}>
      <Ionicons name={icon} size={17} color={colors.primary} />
      <View style={styles.infoCopy}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
    padding: spacing.md,
    paddingBottom: spacing.xl + 88
  },
  header: {
    gap: spacing.md
  },
  hero: {
    gap: spacing.md,
    backgroundColor: colors.text,
    borderColor: colors.text
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary
  },
  heroCopy: {
    flex: 1,
    minWidth: 0
  },
  heroLabel: {
    color: "#FDBA74",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  heroValue: {
    color: "#FFFFFF",
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900",
    marginTop: 2
  },
  heroStats: {
    flexDirection: "row",
    gap: spacing.sm
  },
  miniTotal: {
    flex: 1,
    minHeight: 64,
    borderRadius: radii.md,
    backgroundColor: "rgba(255,255,255,0.09)",
    padding: spacing.sm,
    justifyContent: "center"
  },
  miniValue: {
    color: "#FFFFFF",
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "900"
  },
  miniLabel: {
    color: "#CBD5E1",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    marginTop: 2
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  metricCard: {
    width: "48.7%",
    minHeight: 112,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
    ...shadow.soft
  },
  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs
  },
  primaryIcon: {
    backgroundColor: colors.primarySoft
  },
  successIcon: {
    backgroundColor: colors.successSoft
  },
  warningIcon: {
    backgroundColor: colors.warningSoft
  },
  neutralIcon: {
    backgroundColor: colors.surfaceAlt
  },
  metricValue: {
    color: colors.text,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "900"
  },
  metricLabel: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800"
  },
  payment: {
    gap: spacing.md,
    borderRadius: radii.lg
  },
  paymentTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm
  },
  paymentTitleWrap: {
    flex: 1,
    minWidth: 0
  },
  paymentAmount: {
    color: colors.text,
    fontSize: 21,
    lineHeight: 26,
    fontWeight: "900"
  },
  paymentMeta: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
    marginTop: 2
  },
  statusPill: {
    minHeight: 34,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    justifyContent: "center"
  },
  primaryPill: {
    backgroundColor: colors.primarySoft
  },
  successPill: {
    backgroundColor: colors.successSoft
  },
  warningPill: {
    backgroundColor: colors.warningSoft
  },
  statusText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "900"
  },
  primaryText: {
    color: colors.primaryDark
  },
  successText: {
    color: colors.success
  },
  warningText: {
    color: colors.warning
  },
  infoLine: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm
  },
  infoCopy: {
    flex: 1,
    minWidth: 0
  },
  infoLabel: {
    color: colors.subtleText,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  infoValue: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
    marginTop: 1
  },
  actions: {
    gap: spacing.sm
  },
  pressed: {
    opacity: opacity.pressed
  }
});
