import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { fetchMe, login as loginRequest, register as registerRequest } from "./api";
import type { AuthResponse, AuthUser, Role } from "./types";

type SessionState = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (fullName: string, email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  refresh: () => Promise<void>;
  isAuthenticated: boolean;
};

const STORAGE_KEY = "tupedido.session";
const SessionContext = createContext<SessionState | null>(null);

function readStoredSession(): AuthResponse | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthResponse;
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: PropsWithChildren) {
  const stored = readStoredSession();
  const [token, setToken] = useState<string | null>(stored?.access_token ?? null);
  const [user, setUser] = useState<AuthUser | null>(stored?.user ?? null);
  const [loading, setLoading] = useState<boolean>(Boolean(token));

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchMe(token)
      .then((profile) => {
        if (cancelled) return;
        setUser(profile);
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            access_token: token,
            token_type: "bearer",
            user: profile
          })
        );
      })
      .catch(() => {
        if (cancelled) return;
        setToken(null);
        setUser(null);
        window.localStorage.removeItem(STORAGE_KEY);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function persist(auth: AuthResponse) {
    setToken(auth.access_token);
    setUser(auth.user);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    return auth.user;
  }

  async function login(email: string, password: string) {
    const auth = await loginRequest(email, password);
    return persist(auth);
  }

  async function register(fullName: string, email: string, password: string) {
    const auth = await registerRequest(fullName, email, password);
    return persist(auth);
  }

  function logout() {
    setToken(null);
    setUser(null);
    window.localStorage.removeItem(STORAGE_KEY);
  }

  async function refresh() {
    if (!token) return;
    const profile = await fetchMe(token);
    setUser(profile);
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        access_token: token,
        token_type: "bearer",
        user: profile
      })
    );
  }

  const value = useMemo<SessionState>(
    () => ({
      user,
      token,
      loading,
      login,
      register,
      logout,
      refresh,
      isAuthenticated: Boolean(user && token)
    }),
    [loading, token, user]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return context;
}

export function hasRole(user: AuthUser | null, role: Role) {
  return user?.role === role;
}
