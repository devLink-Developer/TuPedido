import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import * as Location from "expo-location";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "../../components/Card";
import { FloatingCartButton } from "../../components/FloatingCartButton";
import { Screen } from "../../components/Screen";
import { SectionHeader } from "../../components/SectionHeader";
import { StateMessage } from "../../components/StateMessage";
import { addCartItem, fetchAddresses, fetchStore } from "../../services/api";
import { useAsyncLoad } from "../../hooks/useAsyncLoad";
import { useCatalogRealtime } from "../../hooks/useCatalogRealtime";
import { useAuth } from "../../state/AuthContext";
import { useAppFeedback } from "../../state/AppFeedbackContext";
import { useCartState } from "../../state/CartContext";
import { colors, radii, spacing } from "../../theme";
import type { Address, Product } from "../../types/api";
import type { RootStackParamList } from "../../navigation/types";
import { friendlyErrorMessage } from "../../utils/apiMessages";
import { formatCurrency } from "../../utils/format";

type Props = NativeStackScreenProps<RootStackParamList, "StoreDetail">;
type CustomerLocation = { latitude: number; longitude: number; source: "address" | "gps" | "route" };

function hasAddressPin(address: Address): address is Address & { latitude: number; longitude: number } {
  return typeof address.latitude === "number" && typeof address.longitude === "number";
}

export function StoreDetailScreen({ route, navigation }: Props) {
  const { slug, latitude, longitude } = route.params;
  const { token } = useAuth();
  const { showDialog, showError, showToast } = useAppFeedback();
  const { itemCount, setCart } = useCartState();
  const [customerLocation, setCustomerLocation] = useState<CustomerLocation | null>(
    typeof latitude === "number" && typeof longitude === "number" ? { latitude, longitude, source: "route" } : null
  );
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [hasConfiguredAddress, setHasConfiguredAddress] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const { data: store, loading, error, reload } = useAsyncLoad(
    () =>
      customerLocation
        ? fetchStore(slug, {
            latitude: customerLocation.latitude,
            longitude: customerLocation.longitude
          })
        : Promise.reject(new Error("Define tu ubicacion para abrir este comercio.")),
    [slug, customerLocation?.latitude, customerLocation?.longitude]
  );

  useEffect(() => {
    if (!token) {
      setHasConfiguredAddress(false);
      return;
    }
    let cancelled = false;
    const shouldResolveLocation = !customerLocation;
    if (shouldResolveLocation) setLocationLoading(true);
    fetchAddresses(token)
      .then((addresses) => {
        if (cancelled) return;
        const geolocated = addresses.filter(hasAddressPin);
        setHasConfiguredAddress(geolocated.length > 0);
        const selected = geolocated.find((address) => address.is_default) ?? geolocated[0];
        if (shouldResolveLocation && selected && typeof selected.latitude === "number" && typeof selected.longitude === "number") {
          setCustomerLocation({ latitude: selected.latitude, longitude: selected.longitude, source: "address" });
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setHasConfiguredAddress(false);
          if (shouldResolveLocation) setLocationError(friendlyErrorMessage(loadError, "No pudimos leer tu direccion."));
        }
      })
      .finally(() => {
        if (!cancelled && shouldResolveLocation) setLocationLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customerLocation, token]);

  const refreshStore = useCallback(async () => {
    await reload();
  }, [reload]);

  useCatalogRealtime({
    onCatalogChange: refreshStore
  });

  const products = useMemo(() => {
    if (!store) return [];
    return store.products.filter((product) => product.is_available && (selectedCategoryId == null || product.product_category_id === selectedCategoryId));
  }, [selectedCategoryId, store]);

  const categories = store?.product_categories ?? [];

  const addProduct = useCallback(
    async (product: Product) => {
      if (!store) return;
      if (!token) {
        showDialog({
          title: "Iniciá sesión",
          message: "Para agregar productos al pedido necesitás ingresar a tu cuenta.",
          variant: "info",
          actions: [
            { label: "Cancelar", variant: "ghost" },
            { label: "Ingresar", onPress: () => navigation.navigate("Auth", { screen: "Login" }) }
          ]
        });
        return;
      }
      if (!hasConfiguredAddress) {
        showDialog({
          title: "Dirección requerida",
          message: "Agregá una dirección con pin desde Perfil antes de pedir.",
          variant: "warning",
          actions: [
            { label: "Cancelar", variant: "ghost" },
            { label: "Ir a perfil", onPress: () => navigation.navigate("CustomerTabs", { screen: "Profile" }) }
          ]
        });
        return;
      }
      try {
        const nextCart = await addCartItem(token, {
          store_id: store.id,
          product_id: product.id,
          quantity: 1,
          customer_latitude: customerLocation?.latitude ?? null,
          customer_longitude: customerLocation?.longitude ?? null
        });
        setCart(nextCart);
        showToast("Articulo agregado", { durationMs: 1500 });
      } catch (addError) {
        showError("No se pudo agregar", friendlyErrorMessage(addError));
      }
    },
    [customerLocation, hasConfiguredAddress, navigation, setCart, showDialog, showError, showToast, store, token]
  );

  const requestGpsLocation = useCallback(async () => {
    setLocationLoading(true);
    setLocationError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setLocationError("Necesitamos permiso de ubicacion para validar este comercio.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCustomerLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude, source: "gps" });
    } catch (gpsError) {
      setLocationError(friendlyErrorMessage(gpsError, "No pudimos obtener tu ubicacion."));
    } finally {
      setLocationLoading(false);
    }
  }, []);

  if (!customerLocation) {
    return (
      <Screen>
        <StateMessage
          title={locationLoading ? "Buscando ubicacion" : "Ubicacion requerida"}
          description={locationError ?? "Usa tu ubicacion para validar si este comercio llega a tu zona."}
          loading={locationLoading}
          actionLabel={locationLoading ? undefined : "Usar mi ubicacion"}
          onAction={locationLoading ? undefined : () => void requestGpsLocation()}
        />
      </Screen>
    );
  }

  if (loading && !store) {
    return <StateMessage title="Cargando comercio" loading />;
  }

  if (error || !store) {
    return <StateMessage title="No se pudo abrir el comercio" description={error ?? undefined} actionLabel="Reintentar" onAction={() => void reload()} />;
  }

  return (
    <Screen noScroll>
      <FlatList
        data={products}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            {store.cover_image_url ? <Image source={{ uri: store.cover_image_url }} style={styles.cover} accessibilityLabel={`Portada de ${store.name}`} /> : null}
            <SectionHeader size="regular" title={store.name} description={`${store.address} - ${store.min_delivery_minutes}-${store.max_delivery_minutes} min`} />
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={[{ id: -1, name: "Todos" }, ...categories]}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.categories}
              renderItem={({ item }) => {
                const active = selectedCategoryId === (item.id === -1 ? null : item.id);
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => setSelectedCategoryId(item.id === -1 ? null : item.id)}
                    style={({ pressed }) => [styles.category, active && styles.categoryActive, pressed && styles.pressed]}
                  >
                    <Text style={[styles.categoryText, active && styles.categoryTextActive]}>{item.name}</Text>
                  </Pressable>
                );
              }}
            />
          </View>
        }
        ListEmptyComponent={<StateMessage title="Sin productos" description="No hay productos disponibles para esta categoría." />}
        renderItem={({ item }) => (
          <Card style={styles.productCard}>
            <View style={styles.productTop}>
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={styles.productImage} accessibilityLabel={`Imagen de ${item.name}`} resizeMode="contain" />
              ) : (
                <View style={styles.productImageFallback}>
                  <Ionicons name="fast-food-outline" size={24} color={colors.primary} />
                </View>
              )}
              <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.productDescription} numberOfLines={2}>{item.description || item.unit_label || "Producto disponible"}</Text>
                {item.has_commercial_discount ? <Text style={styles.discount}>Promo aplicada</Text> : null}
              </View>
            </View>
            <View style={styles.productFooter}>
              <Text style={styles.price} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{formatCurrency(item.final_price)}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Agregar ${item.name}`}
                android_ripple={{ color: "rgba(255,255,255,0.22)" }}
                onPress={() => void addProduct(item)}
                style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
              >
                <Ionicons name="add-circle-outline" size={17} color="#FFFFFF" />
                <Text style={styles.addButtonText}>Agregar</Text>
              </Pressable>
            </View>
          </Card>
        )}
      />
      <FloatingCartButton itemCount={token ? itemCount : 0} onPress={() => navigation.navigate("Cart")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
    padding: spacing.md,
    paddingBottom: spacing.xl + 88
  },
  header: {
    gap: spacing.md
  },
  cover: {
    width: "100%",
    height: 158,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceAlt
  },
  categories: {
    gap: spacing.sm
  },
  category: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  categoryActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  pressed: {
    opacity: 0.78
  },
  categoryText: {
    color: colors.text,
    fontWeight: "800"
  },
  categoryTextActive: {
    color: "#FFFFFF"
  },
  productCard: {
    gap: spacing.sm,
    borderRadius: radii.lg
  },
  productTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  productImage: {
    width: 86,
    height: 86,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt
  },
  productImageFallback: {
    width: 86,
    height: 86,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  productInfo: {
    flex: 1,
    minWidth: 0,
    gap: 3
  },
  productName: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "900"
  },
  productDescription: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 17
  },
  productFooter: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingTop: spacing.xs
  },
  price: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "900",
    includeFontPadding: false
  },
  discount: {
    color: colors.success,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800"
  },
  addButton: {
    minHeight: 42,
    minWidth: 108,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900"
  }
});
