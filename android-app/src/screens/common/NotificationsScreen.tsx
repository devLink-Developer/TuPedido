import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppButton } from "../../components/AppButton";
import { Card } from "../../components/Card";
import { Screen } from "../../components/Screen";
import { SectionHeader } from "../../components/SectionHeader";
import { StateMessage } from "../../components/StateMessage";
import type { RootStackParamList } from "../../navigation/types";
import { markNotificationRead } from "../../services/api";
import { useAppFeedback } from "../../state/AppFeedbackContext";
import { useAuth } from "../../state/AuthContext";
import { useNotificationsState } from "../../state/NotificationsContext";
import { colors, spacing } from "../../theme";
import { friendlyErrorMessage } from "../../utils/apiMessages";
import { formatDateTime } from "../../utils/format";

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export function NotificationsScreen() {
  const navigation = useNavigation<Navigation>();
  const { token, user } = useAuth();
  const { showError } = useAppFeedback();
  const { notifications, setNotifications, error } = useNotificationsState();

  async function markRead(id: number) {
    if (!token) return;
    try {
      const updated = await markNotificationRead(token, id);
      setNotifications((current) => current.map((item) => (item.id === id ? updated : item)));
    } catch (markError) {
      showError("No se pudo marcar", friendlyErrorMessage(markError));
    }
  }

  function openNotification(orderId: number | null) {
    if (!orderId) return;
    if (user?.role === "delivery") {
      navigation.navigate("DeliveryOrderDetail", { orderId });
      return;
    }
    navigation.navigate("OrderDetail", { orderId });
  }

  return (
    <Screen noScroll>
      <View style={styles.wrap}>
        <SectionHeader size="large" title="Notificaciones" description={error ?? "Novedades de tus pedidos y tu cuenta."} />
        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<StateMessage title="Sin notificaciones" description="Cuando haya novedades de pedidos aparecerán acá." />}
          renderItem={({ item }) => {
            const canOpenOrder = Boolean(item.order_id);
            return (
              <Pressable
                accessibilityRole={canOpenOrder ? "button" : "text"}
                disabled={!canOpenOrder}
                onPress={() => openNotification(item.order_id)}
                style={({ pressed }) => [pressed && styles.pressed]}
              >
                <Card style={[styles.notification, !item.is_read && styles.unread]}>
                  <View style={styles.titleRow}>
                    <Text style={styles.title}>{item.title}</Text>
                    {!item.is_read ? <View style={styles.unreadDot} /> : null}
                  </View>
                  <Text style={styles.body}>{item.body}</Text>
                  <Text style={styles.date}>{formatDateTime(item.created_at)}</Text>
                  <View style={styles.actions}>
                    {canOpenOrder ? <Text style={styles.link}>Ver pedido</Text> : null}
                    {!item.is_read ? <AppButton title="Marcar leída" icon="checkmark-done-outline" onPress={() => void markRead(item.id)} variant="ghost" /> : null}
                  </View>
                </Card>
              </Pressable>
            );
          }}
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
  pressed: {
    opacity: 0.78
  },
  notification: {
    gap: spacing.sm
  },
  unread: {
    borderColor: colors.primary
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  title: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: "900"
  },
  unreadDot: {
    backgroundColor: colors.primary,
    borderRadius: 5,
    height: 10,
    width: 10
  },
  body: {
    color: colors.mutedText,
    lineHeight: 20
  },
  date: {
    color: colors.mutedText,
    fontSize: 12
  },
  actions: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between"
  },
  link: {
    color: colors.primaryDark,
    fontWeight: "900"
  }
});
