import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import {
  addCartItem,
  clearCart,
  fetchCart,
  removeCartItem,
  updateCart,
  updateCartItem
} from "../../app/api";
import { useSession } from "../../app/session";
import type { Cart, CartItem } from "../../app/types";

type CartContextValue = {
  cart: Cart | null;
  items: CartItem[];
  loading: boolean;
  error: string | null;
  itemCount: number;
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  total: number;
  storeId: number | null;
  storeSlug: string | null;
  storeName: string | null;
  deliveryMode: "delivery" | "pickup";
  refreshCart: () => Promise<void>;
  setDeliveryMode: (mode: "delivery" | "pickup") => Promise<void>;
  addItem: (payload: { storeId: number; productId: number; quantity?: number; note?: string | null }) => Promise<void>;
  updateItem: (itemId: number, payload: { quantity: number; note?: string | null }) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  clear: () => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: PropsWithChildren) {
  const { token, isAuthenticated } = useSession();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshCart() {
    if (!token || !isAuthenticated) {
      setCart(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setCart(await fetchCart(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el carrito");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshCart();
  }, [token, isAuthenticated]);

  async function mutate<T>(task: () => Promise<T>) {
    if (!token) {
      throw new Error("Debes iniciar sesion para usar el carrito");
    }
    setError(null);
    try {
      const result = await task();
      await refreshCart();
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo actualizar el carrito";
      setError(message);
      throw err;
    }
  }

  const value = useMemo<CartContextValue>(() => {
    const items = cart?.items ?? [];
    return {
      cart,
      items,
      loading,
      error,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: cart?.subtotal ?? 0,
      deliveryFee: cart?.delivery_fee ?? 0,
      serviceFee: cart?.service_fee ?? 0,
      total: cart?.total ?? 0,
      storeId: cart?.store_id ?? null,
      storeSlug: cart?.store_slug ?? null,
      storeName: cart?.store_name ?? null,
      deliveryMode: cart?.delivery_mode ?? "delivery",
      refreshCart,
      setDeliveryMode: (mode) =>
        mutate(async () => {
          await updateCart(token!, mode);
        }),
      addItem: (payload) =>
        mutate(async () => {
          await addCartItem(token!, {
            store_id: payload.storeId,
            product_id: payload.productId,
            quantity: payload.quantity ?? 1,
            note: payload.note ?? null
          });
        }),
      updateItem: (itemId, payload) =>
        mutate(async () => {
          await updateCartItem(token!, itemId, payload);
        }),
      removeItem: (itemId) =>
        mutate(async () => {
          await removeCartItem(token!, itemId);
        }),
      clear: () =>
        mutate(async () => {
          await clearCart(token!);
        })
    };
  }, [cart, error, loading, token]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within CartProvider");
  }
  return context;
}
