import type { Cart } from "../../types/api";
import { withPricing } from "../../utils/pricing";
import { apiRequest } from "./client";

type RawCart = Omit<Cart, "pricing"> & {
  pricing?: Partial<Cart["pricing"]> | null;
};

type CustomerLocationPayload = {
  customer_latitude?: number | null;
  customer_longitude?: number | null;
};

function mapCart(cart: RawCart): Cart {
  return withPricing(cart) as Cart;
}

export async function fetchCart(token: string): Promise<Cart> {
  return mapCart(await apiRequest<RawCart>("/cart", { token }));
}

export async function updateCart(
  token: string,
  delivery_mode: "delivery" | "pickup",
  location: CustomerLocationPayload = {}
): Promise<Cart> {
  return mapCart(
    await apiRequest<RawCart>("/cart", {
      method: "PUT",
      token,
      body: JSON.stringify({ delivery_mode, ...location })
    })
  );
}

export async function addCartItem(
  token: string,
  payload: { store_id: number; product_id: number; quantity?: number; note?: string | null } & CustomerLocationPayload
): Promise<Cart> {
  return mapCart(
    await apiRequest<RawCart>("/cart/items", {
      method: "POST",
      token,
      body: JSON.stringify(payload)
    })
  );
}

export async function updateCartItem(token: string, itemId: number, payload: { quantity: number; note?: string | null }): Promise<Cart> {
  return mapCart(
    await apiRequest<RawCart>(`/cart/items/${itemId}`, {
      method: "PUT",
      token,
      body: JSON.stringify(payload)
    })
  );
}

export async function removeCartItem(token: string, itemId: number): Promise<Cart> {
  return mapCart(await apiRequest<RawCart>(`/cart/items/${itemId}`, { method: "DELETE", token }));
}

export async function clearCart(token: string): Promise<Cart> {
  return mapCart(await apiRequest<RawCart>("/cart", { method: "DELETE", token }));
}
