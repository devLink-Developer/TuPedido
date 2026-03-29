import { useAuthStore } from "../stores";

export function useAuthSession() {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const hydrated = useAuthStore((state) => state.hydrated);
  const loading = useAuthStore((state) => state.loading);
  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);
  const changePassword = useAuthStore((state) => state.changePassword);
  const refresh = useAuthStore((state) => state.refresh);
  const logout = useAuthStore((state) => state.logout);

  return {
    user,
    token,
    hydrated,
    loading,
    login,
    register,
    changePassword,
    refresh,
    logout,
    isAuthenticated: Boolean(user && token)
  };
}
