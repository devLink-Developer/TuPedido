import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "./AppShell";
import { RequireRoles, GuestOnlyRoute, PasswordChangeRoute } from "./guards";
import { LegacyCustomerOrderRedirectRoute, LegacyCustomerOrdersRedirectRoute } from "./legacyCustomerRoutes";
import { RouteErrorBoundary } from "./RouteErrorBoundary";
import {
  LazyAdminAppearanceRoute,
  LazyAdminDashboardRoute,
  LazyAdminLiquidationsRoute,
  LazyAdminMercadoPagoRoute,
  LazyAdminModuleLayoutRoute,
  LazyAdminOrdersRoute,
  LazyAdminSettingsRoute,
  LazyAdminStoresRoute,
  LazyAdminUsersRoute,
  LazyClienteCartRoute,
  LazyClienteCatalogRoute,
  LazyClienteCheckoutRoute,
  LazyClienteModuleLayoutRoute,
  LazyClienteOrderRoute,
  LazyClienteOrdersRoute,
  LazyClienteProfileRoute,
  LazyClienteStoreDetailRoute,
  LazyComercioDashboardRoute,
  LazyComercioLiquidationsRoute,
  LazyComercioMercadoPagoRoute,
  LazyComercioModuleLayoutRoute,
  LazyComercioOrdersRoute,
  LazyComercioProductsRoute,
  LazyComercioPromotionsRoute,
  LazyComercioCoverageRoute,
  LazyComercioRidersRoute,
  LazyComercioSettingsRoute,
  LazyForcePasswordChangeRoute,
  LazyLandingRoute,
  LazyMercadoPagoCardPaymentRoute,
  LazyLoginRoute,
  LazyMercadoPagoSimulatedRoute,
  LazyMerchantRegistrationRoute,
  LazyRegisterRoute,
  LazyRiderDashboardRoute,
  LazyRiderEarningsRoute,
  LazyRiderHistoryRoute,
  LazyRiderModuleLayoutRoute,
  LazyRiderOrdersRoute
} from "./lazy";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <LazyLandingRoute /> },
      {
        path: "login",
        element: (
          <GuestOnlyRoute>
            <LazyLoginRoute />
          </GuestOnlyRoute>
        )
      },
      {
        path: "registro",
        element: (
          <GuestOnlyRoute>
            <LazyRegisterRoute />
          </GuestOnlyRoute>
        )
      },
      { path: "payments/mercadopago/simulated", element: <LazyMercadoPagoSimulatedRoute /> },
      { path: "payments/mercadopago/card", element: <LazyMercadoPagoCardPaymentRoute /> },
      { path: "merchant-apply", element: <Navigate to="/registro-comercio" replace /> },
      {
        path: "cambiar-contrasena",
        element: (
          <PasswordChangeRoute>
            <LazyForcePasswordChangeRoute />
          </PasswordChangeRoute>
        )
      },
      { path: "registro-comercio", element: <LazyMerchantRegistrationRoute /> },
      {
        path: "c",
        element: <LazyClienteModuleLayoutRoute />,
        children: [
          { index: true, element: <LazyClienteCatalogRoute /> },
          { path: "tienda/:id", element: <LazyClienteStoreDetailRoute /> },
          {
            element: <RequireRoles roles={["customer"]} />,
            children: [
              { path: "carrito", element: <LazyClienteCartRoute /> },
              { path: "checkout", element: <LazyClienteCheckoutRoute /> },
              { path: "pedido/:id", element: <LazyClienteOrderRoute /> },
              { path: "pedidos", element: <LazyClienteOrdersRoute /> },
              { path: "perfil", element: <LazyClienteProfileRoute /> }
            ]
          }
        ]
      },
      {
        path: "orders",
        element: <RequireRoles roles={["customer"]} />,
        children: [
          { index: true, element: <LegacyCustomerOrdersRedirectRoute /> },
          { path: ":id", element: <LegacyCustomerOrderRedirectRoute /> }
        ]
      },
      {
        path: "m",
        element: <RequireRoles roles={["merchant"]} />,
        children: [
          {
            element: <LazyComercioModuleLayoutRoute />,
            children: [
              { index: true, element: <Navigate to="pedidos" replace /> },
              { path: "dashboard", element: <LazyComercioDashboardRoute /> },
              { path: "liquidaciones", element: <LazyComercioLiquidationsRoute /> },
              { path: "mercadopago", element: <LazyComercioMercadoPagoRoute /> },
              { path: "productos", element: <LazyComercioProductsRoute /> },
              { path: "pedidos", element: <LazyComercioOrdersRoute /> },
              { path: "riders", element: <LazyComercioRidersRoute /> },
              { path: "promociones", element: <LazyComercioPromotionsRoute /> },
              { path: "alcance", element: <LazyComercioCoverageRoute /> },
              { path: "configuracion", element: <LazyComercioSettingsRoute /> }
            ]
          }
        ]
      },
      {
        path: "r",
        element: <RequireRoles roles={["delivery"]} />,
        children: [
          {
            element: <LazyRiderModuleLayoutRoute />,
            children: [
              { index: true, element: <LazyRiderDashboardRoute /> },
              { path: "pedidos", element: <LazyRiderOrdersRoute /> },
              { path: "historial", element: <LazyRiderHistoryRoute /> },
              { path: "ganancias", element: <LazyRiderEarningsRoute /> }
            ]
          }
        ]
      },
      {
        path: "a",
        element: <RequireRoles roles={["admin"]} />,
        children: [
          {
            element: <LazyAdminModuleLayoutRoute />,
            children: [
              { index: true, element: <LazyAdminDashboardRoute /> },
              { path: "liquidaciones", element: <LazyAdminLiquidationsRoute /> },
              { path: "usuarios", element: <LazyAdminUsersRoute /> },
              { path: "comercios", element: <LazyAdminStoresRoute /> },
              { path: "pedidos", element: <LazyAdminOrdersRoute /> },
              { path: "mercadopago", element: <LazyAdminMercadoPagoRoute /> },
              { path: "apariencia", element: <LazyAdminAppearanceRoute /> },
              { path: "rubros", element: <LazyAdminSettingsRoute /> },
              { path: "configuracion", element: <Navigate to="rubros" replace /> }
            ]
          }
        ]
      },
      { path: "*", element: <Navigate to="/" replace /> }
    ]
  }
]);
