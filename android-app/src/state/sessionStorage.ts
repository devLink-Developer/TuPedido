import * as SecureStore from "expo-secure-store";
import type { AuthResponse } from "../types/api";

export const SESSION_STORAGE_KEY = "kepedimos.mobile.session";

export async function readStoredSession(): Promise<AuthResponse | null> {
  const value = await SecureStore.getItemAsync(SESSION_STORAGE_KEY);
  if (!value) return null;
  try {
    return JSON.parse(value) as AuthResponse;
  } catch {
    await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
    return null;
  }
}

export async function writeStoredSession(auth: AuthResponse | null): Promise<void> {
  if (!auth) {
    await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
    return;
  }
  await SecureStore.setItemAsync(SESSION_STORAGE_KEY, JSON.stringify(auth));
}
