import Constants from "expo-constants";

export const DEFAULT_BACKEND_ROOT_URL = "https://kepedimos.com";
export const DEFAULT_API_BASE_URL = `${DEFAULT_BACKEND_ROOT_URL}/api/v1`;

type ExpoExtra = {
  apiBaseUrl?: string;
  backendRootUrl?: string;
  expoProjectId?: string;
  eas?: {
    projectId?: string;
  };
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

function cleanText(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

export const EXPO_PROJECT_ID =
  cleanText(process.env.EXPO_PUBLIC_EXPO_PROJECT_ID) ??
  cleanText(extra.expoProjectId) ??
  cleanText(extra.eas?.projectId);

export const MAP_INITIAL_REGION = extra.mapInitialRegion ?? {
  latitude: -31.4201,
  longitude: -64.1888,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08
};
