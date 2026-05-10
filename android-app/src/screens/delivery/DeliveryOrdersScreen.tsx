import { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppButton } from "../../components/AppButton";
import { Card } from "../../components/Card";
import { Screen } from "../../components/Screen";
import { SectionHeader } from "../../components/SectionHeader";
import { StateMessage } from "../../components/StateMessage";
import { acceptDeliveryOrder, fetchDeliveryOrders, pickupDeliveryOrder } from "../../services/api";
import { useAppFeedback } from "../../state/AppFeedbackContext";
import { useAuth } from "../../state/AuthContext";
import { colors, spacing } from "../../theme";
import type { Order } from "../../types/api";
import type { DeliveryTabsParamList, RootStackParamList } from "../../navigation/types";
import { friendlyErrorMessage } from "../../utils/apiMessages";
import { formatCurrency } from "../../utils/format";
import { labelForStatus } from "../../utils/labels";

type Props = BottomTabScreenProps<DeliveryTabsParamList, "DeliveryOrders">;
type RootNav = NativeStackNavigationProp<RootStackParamList>;

export function DeliveryOrdersScreen(_props: Props) {
  const navigation = useNavigation<RootNav>();
  const { token } = useAuth();
  const { showError } = useAppFeedback();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setOrders(await fetchDeliveryOrders(token));
    } catch (loadError) {
      setError(friendlyErrorMessage(loadError, "No se pudieron cargar pedidos"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function runAction(action: "accept" | "pickup", orderId: number) {
    if (!token) return;
    try {
      const updated = action === "accept" ? await acceptDeliveryOrder(token, orderId) : await pickupDeliveryOrder(token, orderId);
      setOrders((current) => current.map((order) => (order.id === updated.id ? updated : order)));
    } catch (actionError) {
      showError("Acción no disponible", friendlyErrorMessage(actionError));
    }
  }

  return (
    <Screen noScroll>
      <View style={styles.wrap}>
        <FlatList
          data={orders}
          keyExtractor={(item) => String(item.id)}
          refreshing={loading}
          onRefresh={() => void load()}
          contentContainerStyle={styles.list}
          ListHeaderComponent={<SectionHeader size="large" title="Pedidos asignados" description={error ?? "Gestioná retiros, entregas y seguimiento."} />}
          ListEmptyComponent={!loading ? <StateMessage title="Sin pedidos" description="Cuando tengas pedidos asignados aparecerán acá." /> : null}
          renderItem={({ item }) => (
            <Card style={styles.order}>
              <Text style={styles.title}>Pedido #{item.id}</Text>
              <Text style={styles.meta}>{item.store_name} - {item.address_full ?? "Sin dirección"}</Text>
              <Text style={styles.meta}>{labelForStatus(item.status)} - {formatCurrency(item.total)}</Text>
              <View style={styles.actions}>
                <AppButton title="Detalle" icon="document-text-outline" onPress={() => navigation.navigate("DeliveryOrderDetail", { orderId: item.id })} variant="ghost" />
                {item.delivery_status === "assigned" || item.status === "created" ? <AppButton title="Aceptar" icon="checkmark-circle-outline" onPress={() => void runAction("accept", item.id)} /> : null}
                {["accepted", "preparing", "ready_for_dispatch"].includes(item.status) ? <AppButton title="Retirado" icon="bag-check-outline" onPress={() => void runAction("pickup", item.id)} /> : null}
              </View>
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
  order: {
    gap: spacing.sm
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  meta: {
    color: colors.mutedText,
    lineHeight: 20
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  }
});
