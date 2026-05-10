import type { NavigatorScreenParams } from "@react-navigation/native";

export type AuthStackParamList = {
  Landing: undefined;
  Login: undefined;
  Register: undefined;
};

export type CustomerTabsParamList = {
  Catalog: undefined;
  Orders: undefined;
  Profile: undefined;
};

export type DeliveryTabsParamList = {
  DeliveryHome: undefined;
  DeliveryOrders: undefined;
  DeliveryEarnings: undefined;
  DeliveryProfile: undefined;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  PublicCatalog: undefined;
  CustomerTabs: NavigatorScreenParams<CustomerTabsParamList> | undefined;
  DeliveryTabs: NavigatorScreenParams<DeliveryTabsParamList> | undefined;
  StoreDetail: { slug: string };
  Cart: undefined;
  Checkout: undefined;
  OrderDetail: { orderId: number; deliveryMode?: boolean };
  DeliveryOrderDetail: { orderId: number };
  PaymentWebView: { checkoutUrl: string; orderId: number };
  Notifications: undefined;
  UnsupportedRole: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
