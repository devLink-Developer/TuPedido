import { useEffect, type PropsWithChildren } from "react";
import { useAuthSession } from "../shared/hooks";
import { useAuthStore } from "../shared/stores";
import type { AuthUser, Role } from "../shared/types";

export function SessionProvider({ children }: PropsWithChildren) {
  const hydrate = useAuthStore((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return <>{children}</>;
}

export function useSession() {
  return useAuthSession();
}

export function hasRole(user: AuthUser | null, role: Role) {
  return user?.role === role;
}
