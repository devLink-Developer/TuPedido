export const DEFAULT_CATALOG_BANNER_URL = "/catalog-banner-default.svg";

export const CATALOG_BANNER_RECOMMENDATION = {
  width: 1600,
  height: 520
} as const;

export function resolveCatalogBannerDimensions(width?: number | null, height?: number | null) {
  const nextWidth =
    typeof width === "number" && Number.isFinite(width) && width > 0 ? Math.round(width) : CATALOG_BANNER_RECOMMENDATION.width;
  const nextHeight =
    typeof height === "number" && Number.isFinite(height) && height > 0 ? Math.round(height) : CATALOG_BANNER_RECOMMENDATION.height;

  return {
    width: nextWidth,
    height: nextHeight
  };
}

function greatestCommonDivisor(a: number, b: number): number {
  let left = Math.abs(a);
  let right = Math.abs(b);

  while (right) {
    [left, right] = [right, left % right];
  }

  return left || 1;
}

export function formatCatalogBannerRatio(width?: number | null, height?: number | null) {
  const resolved = resolveCatalogBannerDimensions(width, height);
  const divisor = greatestCommonDivisor(resolved.width, resolved.height);

  return `${resolved.width / divisor}:${resolved.height / divisor}`;
}
