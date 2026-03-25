import { Outlet } from "react-router-dom";
import { RiderLayout } from "../../app/layouts/RiderLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { EarningsPage } from "./pages/EarningsPage";
import { HistoryPage } from "./pages/HistoryPage";
import { OrdersPage } from "./pages/OrdersPage";

export function RiderModuleLayoutRoute() {
  return (
    <RiderLayout>
      <Outlet />
    </RiderLayout>
  );
}

export function RiderDashboardRoute() {
  return <DashboardPage />;
}

export function RiderOrdersRoute() {
  return <OrdersPage />;
}

export function RiderHistoryRoute() {
  return <HistoryPage />;
}

export function RiderEarningsRoute() {
  return <EarningsPage />;
}
