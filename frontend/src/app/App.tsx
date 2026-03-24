import { Navigate, Route, Routes } from "react-router-dom";
import { MobileShell } from "../components/layout/MobileShell";
import { Guard, PublicOnly } from "./pages/common";
import { LoginPage, MercadoPagoSimulatedPage, RegisterRedirectPage, RootAliasPage } from "./pages/public";
import { HomePage } from "./pages/home";
import { StoreDetailPage } from "./pages/storefront";
import { DeliveryApplyPage, DeliveryDashboardPage } from "./pages/delivery";
import {
  AddressesPage,
  CartPage,
  CheckoutPage,
  MerchantApplyPage,
  OrderDetailPage,
  OrdersPage
} from "./pages/customer";
import { AdminDashboardPage } from "./pages/admin";
import { MerchantDashboardPage } from "./pages/merchant";

export default function App() {
  return (
    <Routes>
      <Route element={<MobileShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/stores" element={<RootAliasPage />} />
        <Route path="/restaurants" element={<RootAliasPage />} />
        <Route path="/stores/:slug" element={<StoreDetailPage />} />
        <Route path="/restaurants/:slug" element={<StoreDetailPage />} />
        <Route
          path="/cart"
          element={
            <Guard>
              <CartPage />
            </Guard>
          }
        />
        <Route
          path="/checkout"
          element={
            <Guard>
              <CheckoutPage />
            </Guard>
          }
        />
        <Route
          path="/addresses"
          element={
            <Guard>
              <AddressesPage />
            </Guard>
          }
        />
        <Route
          path="/orders"
          element={
            <Guard>
              <OrdersPage />
            </Guard>
          }
        />
        <Route
          path="/orders/:id"
          element={
            <Guard>
              <OrderDetailPage />
            </Guard>
          }
        />
        <Route
          path="/merchant-apply"
          element={<MerchantApplyPage />}
        />
        <Route path="/delivery-apply" element={<DeliveryApplyPage />} />
        <Route
          path="/merchant"
          element={
            <Guard roles={["merchant"]}>
              <MerchantDashboardPage />
            </Guard>
          }
        />
        <Route
          path="/delivery"
          element={
            <Guard roles={["delivery"]}>
              <DeliveryDashboardPage />
            </Guard>
          }
        />
        <Route
          path="/admin"
          element={
            <Guard roles={["admin"]}>
              <AdminDashboardPage />
            </Guard>
          }
        />
        <Route path="/payments/mercadopago/simulated" element={<MercadoPagoSimulatedPage />} />
        <Route
          path="/login"
          element={
            <PublicOnly>
              <LoginPage mode="login" />
            </PublicOnly>
          }
        />
        <Route path="/register" element={<RegisterRedirectPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
