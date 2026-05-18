import { Platform } from "react-native";
import { API_BASE_URL, APP_BUILD_NUMBER, APP_VERSION, APP_VERSION_LABEL } from "../config/env";

export function runtimeDiagnosticLabel(): string {
  const osVersion = Platform.Version ? String(Platform.Version) : "unknown";
  const osLabel = Platform.OS === "android" ? `Android ${osVersion}` : `${Platform.OS} ${osVersion}`;
  return `Runtime: app ${APP_VERSION_LABEL}, ${osLabel}, api ${API_BASE_URL}`;
}

export function appVersionLabel(): string {
  return `Version ${APP_VERSION} (${APP_BUILD_NUMBER})`;
}
