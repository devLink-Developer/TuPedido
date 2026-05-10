import { useCallback, useEffect, useState } from "react";
import { friendlyErrorMessage } from "../utils/apiMessages";

export function useAsyncLoad<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loader();
      setData(result);
      return result;
    } catch (loadError) {
      setError(friendlyErrorMessage(loadError, "No se pudo cargar la información"));
      throw loadError;
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    void reload().catch(() => undefined);
  }, [reload]);

  return { data, setData, loading, error, reload };
}
