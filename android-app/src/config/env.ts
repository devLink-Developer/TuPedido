import Constants from "expo-constants";

export const DEFAULT_BACKEND_ROOT_URL = "http://200.58.107.187:8016";
export const DEFAULT_API_BASE_URL = `${DEFAULT_BACKEND_ROOT_URL}/api/v1`;

type ExpoExtra = {
  apiBaseUrl?: string;
  backendRootUrl?: string;
  mapInitialRegion?: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
};

const extra = (Constants.expoConfig?.extra ?? {}) as ExpoExtra;

function cleanUrl(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, "");
}

export const API_BASE_URL =
  cleanUrl(process.env.EXPO_PUBLIC_API_BASE_URL) ??
  cleanUrl(extra.apiBaseUrl) ??
  DEFAULT_API_BASE_URL;

export const BACKEND_ROOT_URL =
  cleanUrl(process.env.EXPO_PUBLIC_BACKEND_ROOT_URL) ??
  cleanUrl(extra.backendRootUrl) ??
  API_BASE_URL.replace(/\/api\/v1\/?$/, "") ??
  DEFAULT_BACKEND_ROOT_URL;

export const MAP_INITIAL_REGION = extra.mapInitialRegion ?? {
  latitude: -31.4201,
  longitude: -64.1888,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08
};
