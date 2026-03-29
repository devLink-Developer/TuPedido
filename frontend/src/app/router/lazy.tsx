import { Suspense, lazy, type ComponentType } from "react";
import { LoadingCard } from "../../shared/components";

type ModuleExports = Record<string, unknown>;

function createLazyRoute(loadModule: () => Promise<ModuleExports>, exportName: string) {
  const LazyComponent = lazy(async () => {
    const module = await loadModule();
    return { default: module[exportName] as ComponentType };
  });

  return function LazyRouteComponent() {
    return (
      <Suspense fallback={<LoadingCard />}>
        <LazyComponent />
      </Suspense>
    );
  };
}

export const LazyLandingRoute = createLazyRoute(() => import("../../modules/landing/routes"), "LandingRoute");

export const LazyLoginRoute = createLazyRoute(() => import("../../modules/auth/routes"), "LoginRoute");
export const LazyRegisterRoute = createLazyRoute(() => import("../../modules/auth/routes"), "RegisterRoute");
export const LazyMerchantRegistrationRoute = createLazyRoute(
  () => import("../../modules/auth/routes"),
  "MerchantRegistrationRoute"
);

export const LazyClienteModuleLayoutRoute = createLazyRoute(
  () => import("../../modules/cliente/routes"),
  "ClienteModuleLayoutRoute"
);
export const LazyClienteCatalogRoute = createLazyRoute(() => import("../../modules/cliente/routes"), "ClienteCatalogRoute");
export const LazyClienteStoreDetailRoute = createLazyRoute(
  () => import("../../modules/cliente/routes"),
  "ClienteStoreDetailRoute"
);
export const LazyClienteCartRoute = createLazyRoute(() => import("../../modules/cliente/routes"), "ClienteCartRoute");
export const LazyClienteCheckoutRoute = createLazyRoute(
  () => import("../../modules/cliente/routes"),
  "ClienteCheckoutRoute"
);
export const LazyClienteOrderRoute = createLazyRoute(() => import("../../modules/cliente/routes"), "ClienteOrderRoute");
export const LazyClienteProfileRoute = createLazyRoute(
  () => import("../../modules/cliente/routes"),
  "ClienteProfileRoute"
);

export const LazyComercioModuleLayoutRoute = createLazyRoute(
  () => import("../../modules/comercio/routes"),
  "ComercioModuleLayoutRoute"
);
export const LazyComercioDashboardRoute = createLazyRoute(
  () => import("../../modules/comercio/routes"),
  "ComercioDashboardRoute"
);
export const LazyComercioProductsRoute = createLazyRoute(
  () => import("../../modules/comercio/routes"),
  "ComercioProductsRoute"
);
export const LazyComercioOrdersRoute = createLazyRoute(
  () => import("../../modules/comercio/routes"),
  "ComercioOrdersRoute"
);
export const LazyComercioRidersRoute = createLazyRoute(
  () => import("../../modules/comercio/routes"),
  "ComercioRidersRoute"
);
export const LazyComercioPromotionsRoute = createLazyRoute(
  () => import("../../modules/comercio/routes"),
  "ComercioPromotionsRoute"
);
export const LazyComercioSettingsRoute = createLazyRoute(
  () => import("../../modules/comercio/routes"),
  "ComercioSettingsRoute"
);

export const LazyRiderModuleLayoutRoute = createLazyRoute(() => import("../../modules/rider/routes"), "RiderModuleLayoutRoute");
export const LazyRiderDashboardRoute = createLazyRoute(() => import("../../modules/rider/routes"), "RiderDashboardRoute");
export const LazyRiderOrdersRoute = createLazyRoute(() => import("../../modules/rider/routes"), "RiderOrdersRoute");
export const LazyRiderHistoryRoute = createLazyRoute(() => import("../../modules/rider/routes"), "RiderHistoryRoute");
export const LazyRiderEarningsRoute = createLazyRoute(() => import("../../modules/rider/routes"), "RiderEarningsRoute");

export const LazyAdminModuleLayoutRoute = createLazyRoute(() => import("../../modules/admin/routes"), "AdminModuleLayoutRoute");
export const LazyAdminDashboardRoute = createLazyRoute(() => import("../../modules/admin/routes"), "AdminDashboardRoute");
export const LazyAdminUsersRoute = createLazyRoute(() => import("../../modules/admin/routes"), "AdminUsersRoute");
export const LazyAdminStoresRoute = createLazyRoute(() => import("../../modules/admin/routes"), "AdminStoresRoute");
export const LazyAdminRidersRoute = createLazyRoute(() => import("../../modules/admin/routes"), "AdminRidersRoute");
export const LazyAdminOrdersRoute = createLazyRoute(() => import("../../modules/admin/routes"), "AdminOrdersRoute");
export const LazyAdminSettingsRoute = createLazyRoute(() => import("../../modules/admin/routes"), "AdminSettingsRoute");
