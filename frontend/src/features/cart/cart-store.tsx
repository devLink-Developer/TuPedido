import { useEffect, type PropsWithChildren } from "react";
import { useAuthSession, useCart as useSharedCart } from "../../shared/hooks";
import { useCartStore } from "../../shared/stores";

export function CartProvider({ children }: PropsWithChildren) {
  const { hydrated, token, user } = useAuthSession();
  const refreshCart = useCartStore((state) => state.refreshCart);
  const resetCart = useCartStore((state) => state.reset);

  useEffect(() => {
    if (!hydrated) return;

    if (token && user) {
      void refreshCart();
      return;
    }

    resetCart();
  }, [hydrated, refreshCart, resetCart, token, user]);

  return <>{children}</>;
}

export function useCart() {
  return useSharedCart();
}
