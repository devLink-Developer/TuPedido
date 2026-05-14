import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from "react-native";
import * as Location from "expo-location";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { brandAssets } from "../../assets/brand";
import { AppButton } from "../../components/AppButton";
import { BrandWordmark } from "../../components/BrandWordmark";
import { FloatingCartButton } from "../../components/FloatingCartButton";
import { IconButton } from "../../components/IconButton";
import { Screen } from "../../components/Screen";
import { SectionHeader } from "../../components/SectionHeader";
import { StateMessage } from "../../components/StateMessage";
import { StoreCard } from "../../components/StoreCard";
import { TextField } from "../../components/TextField";
import { useCatalogRealtime } from "../../hooks/useCatalogRealtime";
import { fetchAddresses, fetchCatalogBanner, fetchCategories, fetchOrders, fetchPlatformBranding, fetchStores } from "../../services/api";
import { useAuth } from "../../state/AuthContext";
import { useCartState } from "../../state/CartContext";
import { useNotificationsState } from "../../state/NotificationsContext";
import { colors, radii, shadow, spacing } from "../../theme";
import type { Address, CatalogBanner, Category, Order, PlatformBranding, StoreSummary } from "../../types/api";
import type { CustomerTabsParamList, RootStackParamList } from "../../navigation/types";
import { friendlyErrorMessage } from "../../utils/apiMessages";
import { formatCurrency } from "../../utils/format";
import { labelForStatus } from "../../utils/labels";
import { CUSTOMER_ORDER_STATUS_NOTIFICATION_EVENTS, pickActiveCustomerOrder } from "../../utils/orders";

type Props = BottomTabScreenProps<CustomerTabsParamList, "Catalog">;
type RootNav = NativeStackNavigationProp<RootStackParamList>;
type DeliveryFilter = "all" | "delivery" | "pickup";
type CustomerLocation = { latitude: number; longitude: number; source: "address" | "gps"; addressId?: number };
const ACTIVE_ORDER_REFRESH_MS = 15000;

const deliveryFilters: Array<{ key: DeliveryFilter; label: string }> = [
  { key: "all", label: "Todos" },
  { key: "delivery", label: "Envío" },
  { key: "pickup", label: "Retiro" }
];

function hasAddressPin(address: Address): address is Address & { latitude: number; longitude: number } {
  return typeof address.latitude === "number" && typeof address.longitude === "number";
}

function pickAddressForCatalog(addresses: Address[], selectedAddressId: number | null) {
  const pinnedAddresses = addresses.filter(hasAddressPin);
  return (
    pinnedAddresses.find((address) => address.id === selectedAddressId) ??
    pinnedAddresses.find((address) => address.is_default) ??
    pinnedAddresses[0] ??
    null
  );
}

function locationFromAddress(address: Address & { latitude: number; longitude: number }): CustomerLocation {
  return {
    latitude: address.latitude,
    longitude: address.longitude,
    source: "address",
    addressId: address.id
  };
}

export function CatalogScreen(_props: Props) {
  const navigation = useNavigation<RootNav>();
  const { user, token } = useAuth();
  const { notifications, unreadCount } = useNotificationsState();
  const { itemCount, refreshCart } = useCartState();
  const lastHandledOrderNotificationIdRef = useRef<number | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [branding, setBranding] = useState<PlatformBranding | null>(null);
  const [banner, setBanner] = useState<CatalogBanner | null>(null);
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [addressSelectorOpen, setAddressSelectorOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>("all");
  const [search, setSearch] = useState("");
  const [customerLocation, setCustomerLocation] = useState<CustomerLocation | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const storeQueryParams = useMemo(
    () => ({
      categorySlug: selectedCategory,
      search: search.trim() || undefined,
      deliveryMode: deliveryFilter === "all" ? undefined : deliveryFilter
    }),
    [deliveryFilter, search, selectedCategory]
  );

  const loadActiveOrder = useCallback(async () => {
    if (!token) {
      setActiveOrder(null);
      return;
    }
    const orders = await fetchOrders(token);
    setActiveOrder(pickActiveCustomerOrder(orders));
  }, [token]);

  const refreshStores = useCallback(async () => {
    if (!customerLocation) {
      setStores([]);
      await loadActiveOrder().catch(() => undefined);
      return;
    }
    const nextStores = await fetchStores({
      ...storeQueryParams,
      latitude: customerLocation.latitude,
      longitude: customerLocation.longitude
    });
    setStores(nextStores);
    if (token) {
      await Promise.all([
        refreshCart({ silent: true }).catch(() => null),
        loadActiveOrder().catch(() => null)
      ]);
    } else {
      setActiveOrder(null);
    }
  }, [customerLocation, loadActiveOrder, refreshCart, storeQueryParams, token]);

  const resolveAddressLocation = useCallback((nextAddresses: Address[]): CustomerLocation | null => {
    const selected = pickAddressForCatalog(nextAddresses, selectedAddressId);
    return selected ? locationFromAddress(selected) : null;
  }, [selectedAddressId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextCategories, nextBranding, nextBanner, nextAddresses, nextOrders] = await Promise.all([
        fetchCategories(),
        fetchPlatformBranding().catch(() => null),
        fetchCatalogBanner().catch(() => null),
        token ? fetchAddresses(token).catch(() => []) : Promise.resolve([]),
        token ? fetchOrders(token).catch(() => []) : Promise.resolve([])
      ]);
      setCategories(nextCategories);
      setBranding(nextBranding);
      setBanner(nextBanner);
      setAddresses(nextAddresses);
      setActiveOrder(pickActiveCustomerOrder(nextOrders));
      const addressLocation = resolveAddressLocation(nextAddresses);
      const nextLocation = customerLocation?.source === "gps" ? customerLocation : addressLocation;
      if (addressLocation && nextLocation?.source === "address") {
        setSelectedAddressId(addressLocation.addressId ?? null);
      }
      if (nextLocation && (customerLocation?.latitude !== nextLocation.latitude || customerLocation?.longitude !== nextLocation.longitude || customerLocation?.source !== nextLocation.source)) {
        setCustomerLocation(nextLocation);
      }
      if (!nextLocation && customerLocation) {
        setCustomerLocation(null);
        setSelectedAddressId(null);
      }
      if (nextLocation) {
        setLocationError(null);
        setStores(
          await fetchStores({
            ...storeQueryParams,
            latitude: nextLocation.latitude,
            longitude: nextLocation.longitude
          })
        );
      } else {
        setStores([]);
      }
      if (token) await refreshCart({ silent: true }).catch(() => null);
    } catch (loadError) {
      setError(friendlyErrorMessage(loadError, "No pudimos cargar el catálogo"));
    } finally {
      setLoading(false);
    }
  }, [customerLocation, refreshCart, resolveAddressLocation, storeQueryParams, token]);

  const requestGpsLocation = useCallback(async () => {
    setLocationLoading(true);
    setLocationError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setLocationError("Necesitamos permiso de ubicacion para mostrar comercios en tu zona.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setSelectedAddressId(null);
      setAddressSelectorOpen(false);
      setCustomerLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        source: "gps"
      });
    } catch (gpsError) {
      setLocationError(friendlyErrorMessage(gpsError, "No pudimos obtener tu ubicacion."));
    } finally {
      setLocationLoading(false);
    }
  }, []);

  const selectAddress = useCallback((address: Address) => {
    if (!hasAddressPin(address)) return;
    setSelectedAddressId(address.id);
    setCustomerLocation(locationFromAddress(address));
    setLocationError(null);
    setAddressSelectorOpen(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void refreshStores().catch(() => undefined);
      const timer = setInterval(() => {
        void loadActiveOrder().catch(() => undefined);
      }, ACTIVE_ORDER_REFRESH_MS);

      return () => {
        clearInterval(timer);
      };
    }, [loadActiveOrder, refreshStores])
  );

  useEffect(() => {
    const latestOrderNotification = notifications.find(
      (notification) => notification.order_id && CUSTOMER_ORDER_STATUS_NOTIFICATION_EVENTS.has(notification.event_type)
    );
    if (!latestOrderNotification || latestOrderNotification.id === lastHandledOrderNotificationIdRef.current) {
      return;
    }

    lastHandledOrderNotificationIdRef.current = latestOrderNotification.id;
    void loadActiveOrder().catch(() => undefined);
  }, [loadActiveOrder, notifications]);

  useCatalogRealtime({
    onCatalogChange: refreshStores
  });

  const firstName = useMemo(() => user?.full_name?.split(" ")[0] || "cliente", [user?.full_name]);
  const bannerSource: ImageSourcePropType = banner?.catalog_banner_image_url ? { uri: banner.catalog_banner_image_url } : brandAssets.catalogBanner;
  const pinnedAddresses = useMemo(() => addresses.filter(hasAddressPin), [addresses]);
  const selectedAddress = useMemo(
    () => pinnedAddresses.find((address) => address.id === selectedAddressId) ?? null,
    [pinnedAddresses, selectedAddressId]
  );
  const hasConfiguredAddress = pinnedAddresses.length > 0;
  const selectedAddressLabel =
    hasConfiguredAddress && selectedAddress
      ? `${selectedAddress.label || "Dirección"} · ${selectedAddress.street}`
      : "Ubicación actual";

  return (
    <Screen noScroll>
      <FlatList
        data={stores}
        keyExtractor={(item) => String(item.id)}
        refreshing={loading}
        onRefresh={() => void load()}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <View style={styles.header}>
              <View style={styles.headerTop}>
                {branding?.platform_wordmark_url ? (
                  <Image source={{ uri: branding.platform_wordmark_url }} style={styles.remoteWordmark} resizeMode="contain" accessibilityLabel="KePedimos" />
                ) : (
                  <BrandWordmark height={34} width={148} />
                )}
                {user ? (
                  <View style={styles.headerActions}>
                    <IconButton icon="notifications-outline" label="Abrir notificaciones" badge={unreadCount} onPress={() => navigation.navigate("Notifications")} />
                  </View>
                ) : (
                  <AppButton title="Ingresar" icon="log-in-outline" variant="ghost" onPress={() => navigation.navigate("Auth", { screen: "Login" })} />
                )}
              </View>
              <View>
                <Text style={styles.greeting}>{user ? `Hola, ${firstName}` : "Pedí cerca"}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: addressSelectorOpen }}
                  disabled={!hasConfiguredAddress}
                  onPress={() => setAddressSelectorOpen((current) => !current)}
                  style={({ pressed }) => [styles.compactLocation, pressed && hasConfiguredAddress && styles.pressed]}
                >
                  <Ionicons name={hasConfiguredAddress ? "location" : "navigate"} size={15} color={colors.primary} />
                  <Text style={styles.compactLocationText} numberOfLines={1}>{selectedAddressLabel}</Text>
                  {hasConfiguredAddress ? <Ionicons name={addressSelectorOpen ? "chevron-up" : "chevron-down"} size={15} color={colors.mutedText} /> : null}
                </Pressable>
              </View>
            </View>

            {addressSelectorOpen && hasConfiguredAddress ? (
              <View style={styles.addressSelector}>
                {pinnedAddresses.map((address) => {
                  const active = selectedAddressId === address.id;
                  return (
                    <Pressable
                      key={address.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => selectAddress(address)}
                      style={({ pressed }) => [styles.addressOption, active && styles.addressOptionActive, pressed && styles.pressed]}
                    >
                      <View style={styles.addressOptionMain}>
                        <Text style={[styles.addressOptionTitle, active && styles.addressOptionTitleActive]} numberOfLines={1}>
                          {address.label || "Dirección"}
                        </Text>
                        <Text style={styles.addressOptionMeta} numberOfLines={1}>{address.street} - {address.locality}</Text>
                      </View>
                      {active ? <Ionicons name="checkmark-circle" size={18} color={colors.primary} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            <Image source={bannerSource} style={styles.banner} resizeMode="cover" accessibilityLabel="Banner de catálogo KePedimos" />

            <TextField
              label="Buscar"
              leftIcon="search-outline"
              value={search}
              onChangeText={setSearch}
              placeholder="Comida, farmacia, dirección..."
              returnKeyType="search"
            />

            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Modalidad</Text>
              <View style={styles.deliveryFilters}>
                {deliveryFilters.map((filter) => {
                  const active = deliveryFilter === filter.key;
                  return (
                    <Pressable
                      key={filter.key}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => setDeliveryFilter(filter.key)}
                      style={({ pressed }) => [styles.deliveryFilter, active && styles.deliveryFilterActive, pressed && styles.categoryPressed]}
                    >
                      <Text style={[styles.deliveryFilterText, active && styles.deliveryFilterTextActive]} numberOfLines={1}>{filter.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={[{ id: 0, name: "Todos", slug: "" } as Category, ...categories]}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.categories}
              renderItem={({ item }) => {
                const active = selectedCategory === (item.slug || undefined);
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`Filtrar por ${item.name}`}
                    onPress={() => setSelectedCategory(item.slug || undefined)}
                    style={({ pressed }) => [styles.category, active && styles.categoryActive, pressed && styles.categoryPressed]}
                  >
                    <Text style={[styles.categoryText, active && styles.categoryTextActive]} numberOfLines={1}>{item.name}</Text>
                  </Pressable>
                );
              }}
            />

            {activeOrder ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`Seguir pedido ${activeOrder.id}`} onPress={() => navigation.navigate("OrderDetail", { orderId: activeOrder.id })} style={({ pressed }) => [styles.activeOrder, pressed && styles.pressed]}>
                <View style={styles.activeOrderIcon}>
                  <Ionicons name="receipt-outline" size={21} color="#FFFFFF" />
                </View>
                <View style={styles.activeOrderMain}>
                  <Text style={styles.activeOrderEyebrow}>Pedido en curso</Text>
                  <Text style={styles.activeOrderText} numberOfLines={1}>{activeOrder.store_name}</Text>
                  <Text style={styles.activeOrderMeta} numberOfLines={1}>{labelForStatus(activeOrder.status)}</Text>
                </View>
                <Text style={styles.activeOrderTotal}>{formatCurrency(activeOrder.total)}</Text>
                <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
              </Pressable>
            ) : null}

            {error ? <StateMessage title="Catálogo no disponible" description={error} actionLabel="Reintentar" onAction={() => void load()} /> : null}

            {!customerLocation && !loading ? (
              <StateMessage
                title="Ubicacion requerida"
                description={locationError ?? "Define una direccion o usa GPS para ver comercios que lleguen hasta tu zona."}
                actionLabel={locationLoading ? "Ubicando..." : "Usar mi ubicacion"}
                onAction={() => void requestGpsLocation()}
              />
            ) : null}

            <SectionHeader size="compact" title="Cerca de vos" description="Filtrá por rubro y elegí dónde pedir." />
          </View>
        }
        ListEmptyComponent={!loading && !error && customerLocation ? <StateMessage title="Sin comercios" description="No hay resultados para la búsqueda actual." /> : null}
        renderItem={({ item }) => (
          <StoreCard
            store={item}
            onPress={() =>
              navigation.navigate("StoreDetail", {
                slug: item.slug,
                latitude: customerLocation?.latitude,
                longitude: customerLocation?.longitude
              })
            }
          />
        )}
      />
      <FloatingCartButton itemCount={user ? itemCount : 0} onPress={() => navigation.navigate("Cart")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl + 88
  },
  headerContent: {
    gap: spacing.md
  },
  header: {
    gap: spacing.sm
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md
  },
  remoteWordmark: {
    width: 148,
    height: 34
  },
  greeting: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900"
  },
  compactLocation: {
    minHeight: 36,
    maxWidth: "100%",
    alignSelf: "flex-start",
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  compactLocationText: {
    flexShrink: 1,
    maxWidth: 220,
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800"
  },
  addressSelector: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
    ...shadow.soft
  },
  addressOption: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  addressOptionActive: {
    backgroundColor: colors.primarySoft
  },
  addressOptionMain: {
    flex: 1,
    minWidth: 0
  },
  addressOptionTitle: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900"
  },
  addressOptionTitleActive: {
    color: colors.primaryDark
  },
  addressOptionMeta: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 16
  },
  headerActions: {
    flexDirection: "row",
    gap: spacing.sm
  },
  banner: {
    width: "100%",
    aspectRatio: 1536 / 580,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceAlt
  },
  filterGroup: {
    gap: spacing.sm
  },
  filterLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900"
  },
  deliveryFilters: {
    flexDirection: "row",
    gap: spacing.sm
  },
  deliveryFilter: {
    flex: 1,
    minHeight: 36,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center"
  },
  deliveryFilterActive: {
    backgroundColor: colors.text,
    borderColor: colors.text
  },
  deliveryFilterText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900"
  },
  deliveryFilterTextActive: {
    color: "#FFFFFF"
  },
  categories: {
    gap: spacing.sm,
    paddingVertical: spacing.xs
  },
  category: {
    width: 96,
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center"
  },
  categoryActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  categoryPressed: {
    opacity: 0.8
  },
  categoryText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800"
  },
  categoryTextActive: {
    color: "#FFFFFF"
  },
  activeOrder: {
    minHeight: 72,
    borderRadius: radii.lg,
    padding: spacing.md,
    backgroundColor: colors.text,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    ...shadow.medium
  },
  pressed: {
    opacity: 0.86
  },
  activeOrderIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  activeOrderMain: {
    flex: 1,
    minWidth: 0
  },
  activeOrderEyebrow: {
    color: "#FDBA74",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  activeOrderText: {
    color: "#FFFFFF",
    marginTop: 2,
    fontWeight: "800"
  },
  activeOrderMeta: {
    color: "#CBD5E1",
    marginTop: 2,
    fontSize: 12,
    fontWeight: "800"
  },
  activeOrderTotal: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900"
  }
});
