import { Outlet } from "react-router-dom";
import { MerchantDashboardLayout } from "../../app/layouts/MerchantDashboardLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { OrdersPage } from "./pages/OrdersPage";
import { ProductsPage } from "./pages/ProductsPage";
import { PromotionsPage } from "./pages/PromotionsPage";
import { SettingsPage } from "./pages/SettingsPage";

export function ComercioModuleLayoutRoute() {
  return (
    <MerchantDashboardLayout>
      <Outlet />
    </MerchantDashboardLayout>
  );
}

export function ComercioDashboardRoute() {
  return <DashboardPage />;
}

export function ComercioProductsRoute() {
  return <ProductsPage />;
}

export function ComercioOrdersRoute() {
  return <OrdersPage />;
}

export function ComercioPromotionsRoute() {
  return <PromotionsPage />;
}

export function ComercioSettingsRoute() {
  return <SettingsPage />;
}
