import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { LoadingCard } from "../../../shared/components";
import { useAuthSession } from "../../../shared/hooks";
import { fetchMerchantStore } from "../../../shared/services/api";
import { getMerchantGuidedSetupStatus } from "../utils/guidedSetup";

type RedirectTarget = "configuracion-guiada" | "pedidos";

export function MerchantHomeRedirectPage() {
  const { token } = useAuthSession();
  const [target, setTarget] = useState<RedirectTarget | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    const sessionToken = token;
    let cancelled = false;

    async function resolveTarget() {
      try {
        const store = await fetchMerchantStore(sessionToken);
        if (!cancelled) {
          setTarget(getMerchantGuidedSetupStatus(store).baseComplete ? "pedidos" : "configuracion-guiada");
        }
      } catch {
        if (!cancelled) {
          setTarget("pedidos");
        }
      }
    }

    void resolveTarget();

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (target) {
    return <Navigate to={target} replace />;
  }

  return <LoadingCard label="Preparando panel..." />;
}
