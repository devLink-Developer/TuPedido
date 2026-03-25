import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "./AppShell";
import { RequireRoles, GuestOnlyRoute } from "./guards";
import {
  LazyAdminDashboardRoute,
  LazyAdminModuleLayoutRoute,
  LazyAdminOrdersRoute,
  LazyAdminRidersRoute,
  LazyAdminSettingsRoute,
  LazyAdminStoresRoute,
  LazyAdminUsersRoute,
  LazyClienteCartRoute,
  LazyClienteCatalogRoute,
  LazyClienteCheckoutRoute,
  LazyClienteModuleLayoutRoute,
  LazyClienteOrderRoute,
  LazyClienteProfileRoute,
  LazyClienteStoreDetailRoute,
  LazyComercioDashboardRoute,
  LazyComercioModuleLayoutRoute,
  LazyComercioOrdersRoute,
  LazyComercioProductsRoute,
  LazyComercioPromotionsRoute,
  LazyComercioSettingsRoute,
  LazyLandingRoute,
  LazyLoginRoute,
  LazyMerchantRegistrationRoute,
  LazyRegisterRoute,
  LazyRiderDashboardRoute,
  LazyRiderEarningsRoute,
  LazyRiderHistoryRoute,
  LazyRiderModuleLayoutRoute,
  LazyRiderOrdersRoute,
  LazyRiderRegistrationRoute
} from "./lazy";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
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
      { path: "registro-comercio", element: <LazyMerchantRegistrationRoute /> },
      { path: "registro-rider", element: <LazyRiderRegistrationRoute /> },
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
              { path: "perfil", element: <LazyClienteProfileRoute /> }
            ]
          }
        ]
      },
      {
        path: "m",
        element: <RequireRoles roles={["merchant"]} />,
        children: [
          {
            element: <LazyComercioModuleLayoutRoute />,
            children: [
              { index: true, element: <LazyComercioDashboardRoute /> },
              { path: "productos", element: <LazyComercioProductsRoute /> },
              { path: "pedidos", element: <LazyComercioOrdersRoute /> },
              { path: "promociones", element: <LazyComercioPromotionsRoute /> },
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
              { path: "usuarios", element: <LazyAdminUsersRoute /> },
              { path: "comercios", element: <LazyAdminStoresRoute /> },
              { path: "riders", element: <LazyAdminRidersRoute /> },
              { path: "pedidos", element: <LazyAdminOrdersRoute /> },
              { path: "configuracion", element: <LazyAdminSettingsRoute /> }
            ]
          }
        ]
      },
      { path: "*", element: <Navigate to="/" replace /> }
    ]
  }
]);
