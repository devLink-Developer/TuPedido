import { create } from "zustand";
import { changePassword as changePasswordRequest, fetchMe, login as loginRequest, register as registerRequest } from "../services/api";
import type { AuthResponse, AuthUser } from "../types";
import { clearDismissedOrderReviewPrompt } from "../utils/orderReviewPrompt";
import { readJsonStorage, removeStorageValue, writeJsonStorage } from "../utils/storage";

const STORAGE_KEY = "kepedimos.session";

type AuthState = {
  user: AuthUser | null;
  token: string | null;
  hydrated: boolean;
  loading: boolean;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (fullName: string, email: string, password: string) => Promise<AuthUser>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<AuthUser>;
  refresh: () => Promise<AuthUser | null>;
  logout: () => void;
  setSession: (auth: AuthResponse | null) => void;
  resetForTest: () => void;
};

function readStoredSession(): AuthResponse | null {
  if (typeof window === "undefined") return null;
  return readJsonStorage<AuthResponse>(window.localStorage, STORAGE_KEY);
}

function persistSession(auth: AuthResponse | null) {
  if (typeof window === "undefined") return;
  if (!auth) {
    removeStorageValue(window.localStorage, STORAGE_KEY);
    return;
  }
  writeJsonStorage(window.localStorage, STORAGE_KEY, auth);
}

const initialStoredSession = readStoredSession();

export const useAuthStore = create<AuthState>((set, get) => ({
  user: initialStoredSession?.user ?? null,
  token: initialStoredSession?.access_token ?? null,
  hydrated: false,
  loading: Boolean(initialStoredSession?.access_token),
  async hydrate() {
    const token = get().token;
    if (!token) {
      set({ user: null, token: null, hydrated: true, loading: false });
      persistSession(null);
      return;
    }

    set({ loading: true });
    try {
      const user = await fetchMe(token);
      const auth: AuthResponse = {
        access_token: token,
        token_type: "bearer",
        user
      };
      persistSession(auth);
      set({ user, hydrated: true, loading: false });
    } catch {
      persistSession(null);
      set({ user: null, token: null, hydrated: true, loading: false });
    }
  },
  async login(email, password) {
    set({ loading: true });
    try {
      const auth = await loginRequest(email, password);
      clearDismissedOrderReviewPrompt();
      persistSession(auth);
      set({
        user: auth.user,
        token: auth.access_token,
        hydrated: true,
        loading: false
      });
      return auth.user;
    } catch (error) {
      set({ loading: false, hydrated: true });
      throw error;
    }
  },
  async register(fullName, email, password) {
    set({ loading: true });
    try {
      const auth = await registerRequest(fullName, email, password);
      clearDismissedOrderReviewPrompt();
      persistSession(auth);
      set({
        user: auth.user,
        token: auth.access_token,
        hydrated: true,
        loading: false
      });
      return auth.user;
    } catch (error) {
      set({ loading: false, hydrated: true });
      throw error;
    }
  },
  async changePassword(currentPassword, newPassword) {
    const token = get().token;
    if (!token) {
      throw new Error("Missing bearer token");
    }

    set({ loading: true });
    try {
      const user = await changePasswordRequest(token, currentPassword, newPassword);
      const auth: AuthResponse = {
        access_token: token,
        token_type: "bearer",
        user
      };
      persistSession(auth);
      set({
        user,
        token,
        hydrated: true,
        loading: false
      });
      return user;
    } catch (error) {
      set({ loading: false, hydrated: true });
      throw error;
    }
  },
  async refresh() {
    const token = get().token;
    if (!token) return null;
    const user = await fetchMe(token);
    const auth: AuthResponse = {
      access_token: token,
      token_type: "bearer",
      user
    };
    persistSession(auth);
    set({ user, hydrated: true, loading: false });
    return user;
  },
  logout() {
    clearDismissedOrderReviewPrompt();
    persistSession(null);
    set({
      user: null,
      token: null,
      hydrated: true,
      loading: false
    });
  },
  setSession(auth) {
    clearDismissedOrderReviewPrompt();
    persistSession(auth);
    set({
      user: auth?.user ?? null,
      token: auth?.access_token ?? null,
      hydrated: true,
      loading: false
    });
  },
  resetForTest() {
    persistSession(null);
    set({
      user: null,
      token: null,
      hydrated: true,
      loading: false
    });
  }
}));
