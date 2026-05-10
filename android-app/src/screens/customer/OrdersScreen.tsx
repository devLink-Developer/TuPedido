import { useCallback, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { OrderCard } from "../../components/OrderCard";
import { Screen } from "../../components/Screen";
import { SectionHeader } from "../../components/SectionHeader";
import { StateMessage } from "../../components/StateMessage";
import { fetchOrders } from "../../services/api";
import { useAuth } from "../../state/AuthContext";
import { spacing } from "../../theme";
import type { CustomerTabsParamList, RootStackParamList } from "../../navigation/types";
import type { Order } from "../../types/api";
import { friendlyErrorMessage } from "../../utils/apiMessages";

type Props = BottomTabScreenProps<CustomerTabsParamList, "Orders">;
type RootNav = NativeStackNavigationProp<RootStackParamList>;

export function OrdersScreen(_props: Props) {
  const navigation = useNavigation<RootNav>();
  const { token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setOrders(await fetchOrders(token));
    } catch (loadError) {
      setError(friendlyErrorMessage(loadError, "No se pudieron cargar los pedidos"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return (
    <Screen noScroll>
      <View style={styles.wrap}>
        <FlatList
          data={orders}
          keyExtractor={(item) => String(item.id)}
          refreshing={loading}
          onRefresh={() => void load()}
          contentContainerStyle={styles.list}
          ListHeaderComponent={<SectionHeader size="large" title="Mis pedidos" description={error ?? "Historial y estado en vivo."} />}
          ListEmptyComponent={!loading ? <StateMessage title="Sin pedidos" description="Cuando hagas tu primer pedido aparecerá acá." /> : null}
          renderItem={({ item }) => <OrderCard order={item} onPress={() => navigation.navigate("OrderDetail", { orderId: item.id })} />}
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
  }
});
