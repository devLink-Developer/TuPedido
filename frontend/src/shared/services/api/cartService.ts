import type { Cart } from "../../types";
import { buildPricingSummary } from "../../utils/pricing";
import { apiRequest } from "./client";

type RawCart = Omit<Cart, "pricing"> & {
  pricing?: Partial<Cart["pricing"]> | null;
};

function mapCart(raw: RawCart): Cart {
  return {
    ...raw,
    pricing: buildPricingSummary(raw)
  };
}

export async function fetchCart(token: string): Promise<Cart> {
  return mapCart(await apiRequest<RawCart>("/cart", { token }));
}

export async function updateCart(token: string, delivery_mode: "delivery" | "pickup"): Promise<Cart> {
  return mapCart(
    await apiRequest<RawCart>("/cart", {
      method: "PUT",
      token,
      body: JSON.stringify({ delivery_mode })
    })
  );
}

export async function addCartItem(
  token: string,
  payload: { store_id: number; product_id: number; quantity?: number; note?: string | null }
): Promise<Cart> {
  return mapCart(
    await apiRequest<RawCart>("/cart/items", {
      method: "POST",
      token,
      body: JSON.stringify(payload)
    })
  );
}

export async function updateCartItem(
  token: string,
  itemId: number,
  payload: { quantity: number; note?: string | null }
): Promise<Cart> {
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
