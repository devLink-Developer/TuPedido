import type { CoveragePoint, MerchantStore, StoreDeliverySettings } from "../../../shared/types";

function isValidPoint(point: CoveragePoint | null | undefined) {
  return (
    point !== null &&
    point !== undefined &&
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    point.latitude >= -90 &&
    point.latitude <= 90 &&
    point.longitude >= -180 &&
    point.longitude <= 180
  );
}

export function hasValidCoveragePolygon(points: CoveragePoint[] | null | undefined) {
  const validPoints = (points ?? []).filter(isValidPoint);
  const uniquePoints = new Set(validPoints.map((point) => `${point.latitude.toFixed(7)}:${point.longitude.toFixed(7)}`));

  return validPoints.length >= 3 && uniquePoints.size >= 3;
}

function hasAnyConfiguredPolygon(settings: StoreDeliverySettings) {
  return hasValidCoveragePolygon(settings.delivery_area_polygon) || hasValidCoveragePolygon(settings.pickup_area_polygon);
}

export function hasGuidedSetupAddress(store: MerchantStore) {
  return Boolean(
    store.address.trim() &&
      store.postal_code?.trim() &&
      store.province?.trim() &&
      store.locality?.trim() &&
      store.latitude !== null &&
      store.longitude !== null
  );
}

export function getMerchantGuidedSetupStatus(store: MerchantStore) {
  const addressReady = hasGuidedSetupAddress(store);
  const coverageReady = hasAnyConfiguredPolygon(store.delivery_settings);
  const deliveryCoverageReady = hasValidCoveragePolygon(store.delivery_settings.delivery_area_polygon);
  const taxonomyReady = store.product_categories.length > 0;
  const productReady = store.products.some((product) => product.is_available);
  const activeRiderReady = (store.delivery_settings.active_riders_count ?? 0) > 0;

  return {
    addressReady,
    coverageReady,
    addressCoverageReady: addressReady && coverageReady,
    taxonomyReady,
    productReady,
    deliveryCoverageReady,
    activeRiderReady,
    deliveryReady: addressReady && deliveryCoverageReady && activeRiderReady,
    baseComplete: addressReady && coverageReady && taxonomyReady && productReady
  };
}
