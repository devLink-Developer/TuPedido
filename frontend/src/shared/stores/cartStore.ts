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
    throw new Error("Debes iniciar sesion para usar el carrito");
  }
  return token;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function recalculateCart(cart: Cart): Cart {
  const subtotal = cart.items.reduce((sum, item) => sum + item.base_unit_price * item.quantity, 0);
  const commercial_discount_total = cart.items.reduce((sum, item) => sum + item.commercial_discount_amount * item.quantity, 0);
  const financial_discount_total = cart.financial_discount_total ?? 0;
  const itemsTotal = cart.items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const delivery_fee = cart.delivery_mode === "delivery" && itemsTotal > 0 ? cart.delivery_fee : 0;
  const service_fee = itemsTotal > 0 ? cart.service_fee : 0;
  const total = itemsTotal + delivery_fee + service_fee;

  return {
    ...cart,
    subtotal,
    commercial_discount_total,
    financial_discount_total,
    delivery_fee,
    service_fee,
    total,
    pricing: {
      subtotal,
      commercialDiscountTotal: commercial_discount_total,
      financialDiscountTotal: financial_discount_total,
      deliveryFee: delivery_fee,
      serviceFee: service_fee,
      total,
      complete: true
    }
  };
}

function buildOptimisticUpdatedCart(
  cart: Cart | null,
  itemId: number,
  payload: { quantity: number; note?: string | null }
): Cart | null {
  if (!cart) {
    return null;
  }

  const items = cart.items.flatMap((item) => {
    if (item.id !== itemId) {
      return [item];
    }

    if (payload.quantity <= 0) {
      return [];
    }

    return [
      {
        ...item,
        quantity: payload.quantity,
        note: payload.note === undefined ? item.note : payload.note
      }
    ];
  });

  return recalculateCart({
    ...cart,
    items
  });
}

export const useCartStore = create<CartState>((set) => ({
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
        error: getErrorMessage(error, "No se pudo cargar el carrito")
      });
    }
  },
  async setDeliveryMode(mode) {
    const token = requireToken();
    set({ error: null });
    try {
      const cart = await updateCart(token, mode);
      set({ cart, error: null });
    } catch (error) {
      set({ error: getErrorMessage(error, "No se pudo actualizar el modo de entrega") });
    }
  },
  async addItem(payload) {
    const token = requireToken();
    set({ error: null });
    try {
      const cart = await addCartItem(token, {
        store_id: payload.storeId,
        product_id: payload.productId,
        quantity: payload.quantity ?? 1,
        note: payload.note ?? null
      });
      set({ cart, error: null });
    } catch (error) {
      set({ error: getErrorMessage(error, "No se pudo agregar el producto al carrito") });
      throw error;
    }
  },
  async updateItem(itemId, payload) {
    const token = requireToken();
    const previousCart = useCartStore.getState().cart;
    const optimisticCart = buildOptimisticUpdatedCart(previousCart, itemId, payload);
    set({ error: null, cart: optimisticCart ?? previousCart });

    try {
      const cart = await updateCartItem(token, itemId, payload);
      set({ cart, error: null });
    } catch (error) {
      set({
        cart: previousCart,
        error: getErrorMessage(error, "No se pudo actualizar el carrito")
      });
    }
  },
  async removeItem(itemId) {
    const token = requireToken();
    const previousCart = useCartStore.getState().cart;
    const optimisticCart = buildOptimisticUpdatedCart(previousCart, itemId, { quantity: 0 });
    set({ error: null, cart: optimisticCart ?? previousCart });

    try {
      const cart = await removeCartItem(token, itemId);
      set({ cart, error: null });
    } catch (error) {
      set({
        cart: previousCart,
        error: getErrorMessage(error, "No se pudo quitar el producto del carrito")
      });
    }
  },
  async clear() {
    const token = requireToken();
    set({ error: null });
    try {
      const cart = await clearCart(token);
      set({ cart, error: null });
    } catch (error) {
      set({ error: getErrorMessage(error, "No se pudo vaciar el carrito") });
    }
  },
  reset() {
    set({ cart: null, error: null, loading: false });
  }
}));
