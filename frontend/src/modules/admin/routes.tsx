import { Outlet } from "react-router-dom";
import { AdminLayout } from "../../app/layouts/AdminLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { LiquidationsPage } from "./pages/LiquidationsPage";
import { OrdersPage } from "./pages/OrdersPage";
import { SettingsPage } from "./pages/SettingsPage";
import { StoresPage } from "./pages/StoresPage";
import { UsersPage } from "./pages/UsersPage";

export function AdminModuleLayoutRoute() {
  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  );
}

export function AdminDashboardRoute() {
  return <DashboardPage />;
}

export function AdminUsersRoute() {
  return <UsersPage />;
}

export function AdminLiquidationsRoute() {
  return <LiquidationsPage />;
}

export function AdminStoresRoute() {
  return <StoresPage />;
}

export function AdminOrdersRoute() {
  return <OrdersPage />;
}

export function AdminSettingsRoute() {
  return <SettingsPage />;
}
