import { useCallback } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppButton } from "../../components/AppButton";
import { Card } from "../../components/Card";
import { Screen } from "../../components/Screen";
import { SectionHeader } from "../../components/SectionHeader";
import { StateMessage } from "../../components/StateMessage";
import { clearCart, updateCartItem } from "../../services/api";
import { useAppFeedback } from "../../state/AppFeedbackContext";
import { useAuth } from "../../state/AuthContext";
import { useCartState } from "../../state/CartContext";
import { colors, radii, spacing } from "../../theme";
import type { CartItem } from "../../types/api";
import type { RootStackParamList } from "../../navigation/types";
import { friendlyErrorMessage } from "../../utils/apiMessages";
import { formatCurrency } from "../../utils/format";

type Props = NativeStackScreenProps<RootStackParamList, "Cart">;

export function CartScreen({ navigation }: Props) {
  const { token } = useAuth();
  const { showDialog, showError } = useAppFeedback();
  const { cart, loading, refreshCart, setCart } = useCartState();
  const commercialDiscount = cart?.pricing.commercial_discount_total ?? 0;
  const financialDiscount = cart?.pricing.financial_discount_total ?? 0;
  const productsTotal = cart ? Math.max(0, cart.pricing.subtotal - commercialDiscount - financialDiscount) : 0;

  const changeQuantity = useCallback(
    async (item: CartItem, quantity: number) => {
      if (!token) return;
      try {
        setCart(await updateCartItem(token, item.id, { quantity, note: item.note }));
      } catch (error) {
        showError("No se pudo actualizar", friendlyErrorMessage(error));
      }
    },
    [setCart, showError, token]
  );

  async function clearCurrentCart() {
    if (!token) return;
    try {
      setCart(await clearCart(token));
    } catch (error) {
      showError("No se pudo vaciar", friendlyErrorMessage(error));
    }
  }

  function handleClear() {
    showDialog({
      title: "Vaciar carrito",
      message: "Se eliminarán todos los productos del pedido actual.",
      variant: "warning",
      actions: [
        { label: "Cancelar", variant: "ghost" },
        { label: "Vaciar", variant: "danger", onPress: () => void clearCurrentCart() }
      ]
    });
  }

  if (!cart || !cart.items.length) {
    return (
      <Screen refreshing={loading} onRefresh={() => void refreshCart()}>
        <StateMessage title="Carrito vacío" description="Agregá productos desde un comercio para continuar." actionLabel="Ir al catálogo" onAction={() => navigation.navigate("CustomerTabs", { screen: "Catalog" })} />
      </Screen>
    );
  }

  return (
    <Screen noScroll>
      <FlatList
        data={cart.items}
        keyExtractor={(item) => String(item.id)}
        refreshing={loading}
        onRefresh={() => void refreshCart()}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<SectionHeader size="large" title="Carrito" description={cart.store_name ?? "Tu pedido"} />}
        renderItem={({ item }) => (
          <Card style={styles.item}>
            <View style={styles.itemMain}>
              <Text style={styles.itemName}>{item.product_name}</Text>
              <Text style={styles.itemMeta}>{formatCurrency(item.unit_price)} c/u</Text>
              {item.note ? <Text style={styles.itemMeta}>{item.note}</Text> : null}
            </View>
            <View style={styles.stepper}>
              <StepperButton icon="remove" label="Quitar unidad" onPress={() => void changeQuantity(item, item.quantity - 1)} />
              <Text style={styles.quantity}>{item.quantity}</Text>
              <StepperButton icon="add" label="Agregar unidad" onPress={() => void changeQuantity(item, item.quantity + 1)} />
            </View>
          </Card>
        )}
        ListFooterComponent={
          <Card style={styles.summary}>
            <View style={styles.summaryLineWrap}>
              <Text style={styles.summaryLine}>Subtotal productos</Text>
              <Text style={styles.summaryValue}>{formatCurrency(cart.pricing.subtotal)}</Text>
            </View>
            {commercialDiscount > 0 ? (
              <View style={styles.summaryLineWrap}>
                <Text style={styles.summaryLine}>Descuentos del comercio</Text>
                <Text style={[styles.summaryValue, styles.discountValue]}>-{formatCurrency(commercialDiscount)}</Text>
              </View>
            ) : null}
            {financialDiscount > 0 ? (
              <View style={styles.summaryLineWrap}>
                <Text style={styles.summaryLine}>Promociones</Text>
                <Text style={[styles.summaryValue, styles.discountValue]}>-{formatCurrency(financialDiscount)}</Text>
              </View>
            ) : null}
            <View style={styles.divider} />
            <View style={styles.summaryLineWrap}>
              <Text style={styles.totalLabel}>Total productos</Text>
              <Text style={styles.total}>{formatCurrency(productsTotal)}</Text>
            </View>
            <AppButton title="Continuar al checkout" icon="card-outline" onPress={() => navigation.navigate("Checkout")} fullWidth />
            <AppButton title="Vaciar carrito" icon="trash-outline" onPress={handleClear} variant="ghost" fullWidth />
          </Card>
        }
      />
    </Screen>
  );
}

function StepperButton({ icon, label, onPress }: { icon: "add" | "remove"; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={8} onPress={onPress} style={({ pressed }) => [styles.stepperButton, pressed && styles.pressed]}>
      <Ionicons name={icon} size={20} color={colors.primaryDark} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
    padding: spacing.md,
    paddingBottom: spacing.xl
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radii.lg
  },
  itemMain: {
    flex: 1,
    minWidth: 0,
    gap: 3
  },
  itemName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  itemMeta: {
    color: colors.mutedText,
    fontSize: 13
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  pressed: {
    opacity: 0.76
  },
  quantity: {
    minWidth: 28,
    textAlign: "center",
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  summary: {
    gap: spacing.md,
    borderRadius: radii.lg
  },
  summaryLineWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  summaryLine: {
    color: colors.mutedText,
    fontWeight: "700"
  },
  summaryValue: {
    color: colors.text,
    fontWeight: "800"
  },
  discountValue: {
    color: colors.success
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
