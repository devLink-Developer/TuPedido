import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { changePassword as changePasswordRequest, deleteAccount as deleteAccountRequest, fetchMe, login as loginRequest, register as registerRequest } from "../services/api";
import type { AuthResponse, AuthUser } from "../types/api";
import { readStoredSession, writeStoredSession } from "./sessionStorage";

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  hydrated: boolean;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (fullName: string, email: string, password: string, acceptedTerms: boolean) => Promise<AuthUser>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<AuthUser>;
  deleteAccount: () => Promise<void>;
  refresh: () => Promise<AuthUser | null>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(true);

  const persistSession = useCallback(async (auth: AuthResponse | null) => {
    await writeStoredSession(auth);
    setUser(auth?.user ?? null);
    setToken(auth?.access_token ?? null);
  }, []);

  const refresh = useCallback(async () => {
    const storedToken = token;
    if (!storedToken) return null;
    const nextUser = await fetchMe(storedToken);
    await persistSession({ access_token: storedToken, token_type: "bearer", user: nextUser });
    return nextUser;
  }, [persistSession, token]);

  useEffect(() => {
    let mounted = true;
    async function hydrate() {
      setLoading(true);
      const stored = await readStoredSession();
      if (!mounted) return;
      if (!stored?.access_token) {
        await persistSession(null);
        if (mounted) {
          setHydrated(true);
          setLoading(false);
        }
        return;
      }
      try {
        const nextUser = await fetchMe(stored.access_token);
        await persistSession({ access_token: stored.access_token, token_type: "bearer", user: nextUser });
      } catch {
        await persistSession(null);
      } finally {
        if (mounted) {
          setHydrated(true);
          setLoading(false);
        }
      }
    }
    void hydrate();
    return () => {
      mounted = false;
    };
  }, [persistSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      try {
        const auth = await loginRequest(email, password);
        await persistSession(auth);
        return auth.user;
      } finally {
        setLoading(false);
        setHydrated(true);
      }
    },
    [persistSession]
  );

  const register = useCallback(
    async (fullName: string, email: string, password: string, acceptedTerms: boolean) => {
      setLoading(true);
      try {
        const auth = await registerRequest(fullName, email, password, acceptedTerms);
        await persistSession(auth);
        return auth.user;
      } finally {
        setLoading(false);
        setHydrated(true);
      }
    },
    [persistSession]
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      if (!token) throw new Error("Sesión no disponible");
      setLoading(true);
      try {
        const nextUser = await changePasswordRequest(token, currentPassword, newPassword);
        await persistSession({ access_token: token, token_type: "bearer", user: nextUser });
        return nextUser;
      } finally {
        setLoading(false);
      }
    },
    [persistSession, token]
  );

  const deleteAccount = useCallback(async () => {
    if (!token) throw new Error("Sesion no disponible");
    setLoading(true);
    try {
      await deleteAccountRequest(token);
      await persistSession(null);
    } finally {
      setLoading(false);
      setHydrated(true);
    }
  }, [persistSession, token]);

  const logout = useCallback(async () => {
    await persistSession(null);
    setHydrated(true);
    setLoading(false);
  }, [persistSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      hydrated,
      loading,
      isAuthenticated: Boolean(token && user),
      login,
      register,
      changePassword,
      deleteAccount,
      refresh,
      logout
    }),
    [changePassword, deleteAccount, hydrated, loading, login, logout, refresh, register, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
