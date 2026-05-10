import { createContext, useCallback, useContext, useMemo, useState, type PropsWithChildren } from "react";
import { fetchCart as fetchCartRequest } from "../services/api";
import type { Cart } from "../types/api";
import { useAuth } from "./AuthContext";

type CartContextValue = {
  cart: Cart | null;
  loading: boolean;
  itemCount: number;
  refreshCart: () => Promise<Cart | null>;
  setCart: (cart: Cart | null) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: PropsWithChildren) {
  const { token, user } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshCart = useCallback(async () => {
    if (!token || user?.role !== "customer") {
      setCart(null);
      return null;
    }
    setLoading(true);
    try {
      const nextCart = await fetchCartRequest(token);
      setCart(nextCart);
      return nextCart;
    } finally {
      setLoading(false);
    }
  }, [token, user?.role]);

  const itemCount = useMemo(() => cart?.items.reduce((total, item) => total + item.quantity, 0) ?? 0, [cart]);

  const value = useMemo<CartContextValue>(
    () => ({ cart, loading, itemCount, refreshCart, setCart }),
    [cart, itemCount, loading, refreshCart]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCartState() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCartState must be used inside CartProvider");
  return value;
}
