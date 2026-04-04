import { Outlet } from "react-router-dom";
import { MerchantDashboardLayout } from "../../app/layouts/MerchantDashboardLayout";
import { MerchantMobileHeaderProvider } from "./MerchantMobileHeaderContext";
import { DashboardPage } from "./pages/DashboardPage";
import { LiquidationsPage } from "./pages/LiquidationsPage";
import { OrdersPage } from "./pages/OrdersPage";
import { ProductsPage } from "./pages/ProductsPage";
import { PromotionsPage } from "./pages/PromotionsPage";
import { RidersPage } from "./pages/RidersPage";
import { SettingsPage } from "./pages/SettingsPage";

export function ComercioModuleLayoutRoute() {
  return (
    <MerchantMobileHeaderProvider>
      <MerchantDashboardLayout>
        <Outlet />
      </MerchantDashboardLayout>
    </MerchantMobileHeaderProvider>
  );
}

export function ComercioDashboardRoute() {
  return <DashboardPage />;
}

export function ComercioProductsRoute() {
  return <ProductsPage />;
}

export function ComercioLiquidationsRoute() {
  return <LiquidationsPage />;
}

export function ComercioOrdersRoute() {
  return <OrdersPage />;
}

export function ComercioRidersRoute() {
  return <RidersPage />;
}

export function ComercioPromotionsRoute() {
  return <PromotionsPage />;
}

export function ComercioSettingsRoute() {
  return <SettingsPage />;
}
