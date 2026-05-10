import { useCallback, useState } from "react";
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
import { colors, spacing } from "../../theme";
import type { DeliverySettlement, DeliverySettlementPayment } from "../../types/api";
import type { DeliveryTabsParamList } from "../../navigation/types";
import { friendlyErrorMessage } from "../../utils/apiMessages";
import { formatCurrency, formatDateTime } from "../../utils/format";

type Props = BottomTabScreenProps<DeliveryTabsParamList, "DeliveryEarnings">;

export function DeliveryEarningsScreen(_props: Props) {
  const { token } = useAuth();
  const { showError } = useAppFeedback();
  const [settlement, setSettlement] = useState<DeliverySettlement | null>(null);
  const [payments, setPayments] = useState<DeliverySettlementPayment[]>([]);
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
      setError(friendlyErrorMessage(loadError, "No se pudieron cargar liquidaciones"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function respond(paymentId: number, response: "confirm" | "dispute") {
    if (!token) return;
    try {
      const updated =
        response === "confirm"
          ? await confirmDeliverySettlementPayment(token, paymentId, "Recibido correctamente")
          : await disputeDeliverySettlementPayment(token, paymentId, "Diferencia reportada desde app móvil");
      setPayments((current) => current.map((item) => (item.id === paymentId ? updated : item)));
    } catch (responseError) {
      showError("No se pudo responder", friendlyErrorMessage(responseError));
    }
  }

  return (
    <Screen noScroll>
      <View style={styles.wrap}>
        <FlatList
          data={payments}
          keyExtractor={(item) => String(item.id)}
          refreshing={loading}
          onRefresh={() => void load()}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.header}>
              <SectionHeader size="large" title="Ganancias" description={error ?? "Liquidaciones y pagos recibidos."} />
              {settlement ? (
                <Card style={styles.summary}>
                  <Text style={styles.big}>{formatCurrency(settlement.pending_amount)}</Text>
                  <Text style={styles.meta}>Pendiente de pago</Text>
                  <Text style={styles.meta}>Ganado: {formatCurrency(settlement.rider_fee_earned_total)} · Pagado: {formatCurrency(settlement.rider_fee_paid_total)}</Text>
                </Card>
              ) : null}
            </View>
          }
          ListEmptyComponent={!loading ? <StateMessage title="Sin pagos" description="No hay pagos registrados para confirmar." /> : null}
          renderItem={({ item }) => (
            <Card style={styles.payment}>
              <Text style={styles.title}>{formatCurrency(item.amount)}</Text>
              <Text style={styles.meta}>{item.store_name ?? "Plataforma"} · {formatDateTime(item.created_at)}</Text>
              <Text style={styles.meta}>Estado: {item.receiver_status}</Text>
              {item.receiver_status === "pending_confirmation" ? (
                <View style={styles.actions}>
                  <AppButton title="Confirmar" icon="checkmark-circle-outline" onPress={() => void respond(item.id, "confirm")} />
                  <AppButton title="Disputar" icon="alert-circle-outline" onPress={() => void respond(item.id, "dispute")} variant="ghost" />
                </View>
              ) : null}
            </Card>
          )}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    padding: spacing.md
  },
  list: {
    gap: spacing.md,
    paddingBottom: spacing.xl
  },
  header: {
    gap: spacing.md
  },
  summary: {
    gap: spacing.xs
  },
  big: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900"
  },
  meta: {
    color: colors.mutedText,
    lineHeight: 20
  },
  payment: {
    gap: spacing.sm
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900"
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  }
});
