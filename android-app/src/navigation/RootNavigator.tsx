import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import type { ComponentType } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";
import { useAuth } from "../state/AuthContext";
import { AppFeedbackProvider } from "../state/AppFeedbackContext";
import { CartProvider } from "../state/CartContext";
import { NotificationsProvider } from "../state/NotificationsContext";
import { OrderReviewPromptProvider } from "../state/OrderReviewPromptContext";
import type { AuthStackParamList, CustomerTabsParamList, DeliveryTabsParamList, RootStackParamList } from "./types";
import { homeForRole } from "./roleRouting";
import { LandingScreen } from "../screens/auth/LandingScreen";
import { LoginScreen } from "../screens/auth/LoginScreen";
import { RegisterScreen } from "../screens/auth/RegisterScreen";
import { CatalogScreen } from "../screens/customer/CatalogScreen";
import { StoreDetailScreen } from "../screens/customer/StoreDetailScreen";
import { CartScreen } from "../screens/customer/CartScreen";
import { CheckoutScreen } from "../screens/customer/CheckoutScreen";
import { OrdersScreen } from "../screens/customer/OrdersScreen";
import { OrderDetailScreen } from "../screens/customer/OrderDetailScreen";
import { ProfileScreen } from "../screens/customer/ProfileScreen";
import { PaymentWebViewScreen } from "../screens/customer/PaymentWebViewScreen";
import { NotificationsScreen } from "../screens/common/NotificationsScreen";
import { DeliveryHomeScreen } from "../screens/delivery/DeliveryHomeScreen";
import { DeliveryOrdersScreen } from "../screens/delivery/DeliveryOrdersScreen";
import { DeliveryOrderDetailScreen } from "../screens/delivery/DeliveryOrderDetailScreen";
import { DeliveryRouteMapScreen } from "../screens/delivery/DeliveryRouteMapScreen";
import { DeliveryEarningsScreen } from "../screens/delivery/DeliveryEarningsScreen";
import { DeliveryProfileScreen } from "../screens/delivery/DeliveryProfileScreen";
import { UnsupportedRoleScreen } from "../screens/common/UnsupportedRoleScreen";

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const CustomerTabs = createBottomTabNavigator<CustomerTabsParamList>();
const DeliveryTabs = createBottomTabNavigator<DeliveryTabsParamList>();
const PublicCatalogScreen = CatalogScreen as unknown as ComponentType;

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border
  }
};

function AuthStackNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Landing" component={LandingScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

function CustomerTabsNavigator() {
  return (
    <CustomerTabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedText,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
        tabBarStyle: styles.tabBar,
        tabBarIcon: ({ color, size }) => {
          const iconSize = Math.min(size, 24);
          if (route.name === "Catalog") return <Ionicons name="storefront-outline" color={color} size={iconSize} />;
          if (route.name === "Orders") return <Ionicons name="receipt-outline" color={color} size={iconSize} />;
          return <Ionicons name="person-circle-outline" color={color} size={iconSize} />;
        }
      })}
    >
      <CustomerTabs.Screen name="Catalog" component={CatalogScreen} options={{ title: "Catálogo" }} />
      <CustomerTabs.Screen name="Orders" component={OrdersScreen} options={{ title: "Pedidos" }} />
      <CustomerTabs.Screen name="Profile" component={ProfileScreen} options={{ title: "Perfil" }} />
    </CustomerTabs.Navigator>
  );
}

function DeliveryTabsNavigator() {
  return (
    <DeliveryTabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedText,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
        tabBarStyle: styles.tabBar,
        tabBarIcon: ({ color, size }) => {
          const iconSize = Math.min(size, 24);
          if (route.name === "DeliveryHome") return <MaterialCommunityIcons name="motorbike" color={color} size={iconSize} />;
          if (route.name === "DeliveryOrders") return <Ionicons name="bag-handle-outline" color={color} size={iconSize} />;
          if (route.name === "DeliveryEarnings") return <Ionicons name="wallet-outline" color={color} size={iconSize} />;
          return <Ionicons name="person-circle-outline" color={color} size={iconSize} />;
        }
      })}
    >
      <DeliveryTabs.Screen name="DeliveryHome" component={DeliveryHomeScreen} options={{ title: "Inicio" }} />
      <DeliveryTabs.Screen name="DeliveryOrders" component={DeliveryOrdersScreen} options={{ title: "Pedidos" }} />
      <DeliveryTabs.Screen name="DeliveryEarnings" component={DeliveryEarningsScreen} options={{ title: "Ganancias" }} />
      <DeliveryTabs.Screen name="DeliveryProfile" component={DeliveryProfileScreen} options={{ title: "Perfil" }} />
    </DeliveryTabs.Navigator>
  );
}

function SplashScreen() {
  return (
    <View style={styles.splash}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.splashText}>Cargando KePedimos</Text>
    </View>
  );
}

export function RootNavigator() {
  const { user, hydrated, loading } = useAuth();

  if (!hydrated && loading) return <SplashScreen />;

  const home = homeForRole(user?.role);

  return (
    <CartProvider>
      <AppFeedbackProvider>
        <NotificationsProvider>
          <OrderReviewPromptProvider>
            <NavigationContainer theme={navigationTheme}>
              <RootStack.Navigator
                screenOptions={{
                  headerTintColor: colors.text,
                  headerTitleStyle: { color: colors.text, fontWeight: "800", fontSize: 20 },
                  headerStyle: { backgroundColor: colors.surface },
                  headerShadowVisible: false,
                  contentStyle: { backgroundColor: colors.background }
                }}
              >
                {!user ? (
                  <>
                    <RootStack.Screen name="Auth" component={AuthStackNavigator} options={{ headerShown: false }} />
                    <RootStack.Screen name="PublicCatalog" component={PublicCatalogScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="StoreDetail" component={StoreDetailScreen} options={{ title: "Comercio" }} />
                  </>
                ) : home === "CustomerTabs" ? (
                  <>
                    <RootStack.Screen name="CustomerTabs" component={CustomerTabsNavigator} options={{ headerShown: false }} />
                    <RootStack.Screen name="StoreDetail" component={StoreDetailScreen} options={{ title: "Comercio" }} />
                    <RootStack.Screen name="Cart" component={CartScreen} options={{ title: "Carrito" }} />
                    <RootStack.Screen name="Checkout" component={CheckoutScreen} options={{ title: "Confirmar pedido" }} />
                    <RootStack.Screen name="OrderDetail" component={OrderDetailScreen} options={{ title: "Pedido" }} />
                    <RootStack.Screen name="PaymentWebView" component={PaymentWebViewScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="Notifications" component={NotificationsScreen} options={{ title: "Notificaciones" }} />
                  </>
                ) : home === "DeliveryTabs" ? (
                  <>
                    <RootStack.Screen name="DeliveryTabs" component={DeliveryTabsNavigator} options={{ headerShown: false }} />
                    <RootStack.Screen name="DeliveryOrderDetail" component={DeliveryOrderDetailScreen} options={{ title: "Entrega" }} />
                    <RootStack.Screen name="DeliveryRouteMap" component={DeliveryRouteMapScreen} options={{ headerShown: false }} />
                    <RootStack.Screen name="Notifications" component={NotificationsScreen} options={{ title: "Notificaciones" }} />
                  </>
                ) : (
                  <RootStack.Screen name="UnsupportedRole" component={UnsupportedRoleScreen} options={{ headerShown: false }} />
                )}
              </RootStack.Navigator>
            </NavigationContainer>
          </OrderReviewPromptProvider>
        </NotificationsProvider>
      </AppFeedbackProvider>
    </CartProvider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    minHeight: 70,
    paddingTop: 8,
    paddingBottom: 10,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    backgroundColor: colors.surface
  },
  tabItem: {
    paddingVertical: 2
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "800"
  },
  splash: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    gap: 16
  },
  splashText: {
    color: colors.text,
    fontWeight: "800"
  }
});
