import { create } from "zustand";
import {
  addCartItem,
  clearCart,
  fetchCart,
  removeCartItem,
  updateCart,
  updateCartItem
} from "../services/api";
import type { Cart } from "../types";
import { useAuthStore } from "./authStore";

type CartState = {
  cart: Cart | null;
  loading: boolean;
  error: string | null;
  refreshCart: () => Promise<void>;
  setDeliveryMode: (mode: "delivery" | "pickup") => Promise<void>;
  addItem: (payload: { storeId: number; productId: number; quantity?: number; note?: string | null }) => Promise<void>;
  updateItem: (itemId: number, payload: { quantity: number; note?: string | null }) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  clear: () => Promise<void>;
  reset: () => void;
};

function requireToken() {
  const token = useAuthStore.getState().token;
  if (!token) {
    throw new Error("Debes iniciar sesión para usar el carrito");
  }
  return token;
}

export const useCartStore = create<CartState>((set, get) => ({
  cart: null,
  loading: false,
  error: null,
  async refreshCart() {
    const token = useAuthStore.getState().token;
    const isAuthenticated = Boolean(useAuthStore.getState().user && token);
    if (!token || !isAuthenticated) {
      set({ cart: null, error: null, loading: false });
      return;
    }

    set({ loading: true, error: null });
    try {
      const cart = await fetchCart(token);
      set({ cart, loading: false });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "No se pudo cargar el carrito"
      });
    }
  },
  async setDeliveryMode(mode) {
    const token = requireToken();
    set({ error: null });
    await updateCart(token, mode);
    await get().refreshCart();
  },
  async addItem(payload) {
    const token = requireToken();
    set({ error: null });
    await addCartItem(token, {
      store_id: payload.storeId,
      product_id: payload.productId,
      quantity: payload.quantity ?? 1,
      note: payload.note ?? null
    });
    await get().refreshCart();
  },
  async updateItem(itemId, payload) {
    const token = requireToken();
    set({ error: null });
    await updateCartItem(token, itemId, payload);
    await get().refreshCart();
  },
  async removeItem(itemId) {
    const token = requireToken();
    set({ error: null });
    await removeCartItem(token, itemId);
    await get().refreshCart();
  },
  async clear() {
    const token = requireToken();
    set({ error: null });
    await clearCart(token);
    await get().refreshCart();
  },
  reset() {
    set({ cart: null, error: null, loading: false });
  }
}));
