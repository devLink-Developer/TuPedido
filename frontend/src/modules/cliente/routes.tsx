import { Outlet } from "react-router-dom";
import { ClienteLayout } from "../../app/layouts/ClienteLayout";
import { CartDrawer } from "./components/CartDrawer";
import { CartPage } from "./pages/CartPage";
import { CatalogPage } from "./pages/CatalogPage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { OrderPage } from "./pages/OrderPage";
import { OrdersPage } from "./pages/OrdersPage";
import { ProfilePage } from "./pages/ProfilePage";
import { StoreDetailPage } from "./pages/StoreDetailPage";

export function ClienteModuleLayoutRoute() {
  return (
    <ClienteLayout>
      <CartDrawer />
      <Outlet />
    </ClienteLayout>
  );
}

export function ClienteCatalogRoute() {
  return <CatalogPage />;
}

export function ClienteStoreDetailRoute() {
  return <StoreDetailPage />;
}

export function ClienteCartRoute() {
  return <CartPage />;
}

export function ClienteCheckoutRoute() {
  return <CheckoutPage />;
}

export function ClienteOrderRoute() {
  return <OrderPage />;
}

export function ClienteOrdersRoute() {
  return <OrdersPage />;
}

export function ClienteProfileRoute() {
  return <ProfilePage />;
}
