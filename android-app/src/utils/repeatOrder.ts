import { addCartItem, updateCart } from "../services/api";
import type { Cart, Order } from "../types/api";

type RepeatLocation = {
  customer_latitude: number | null;
  customer_longitude: number | null;
};

export type RepeatOrderResult = {
  cart: Cart | null;
  addedItemCount: number;
  failedItemNames: string[];
  priceChangedItemNames: string[];
  deliveryModeWarning: boolean;
};

function pricesDiffer(left: number, right: number) {
  return Math.abs(left - right) >= 0.01;
}

function repeatLocationForOrder(order: Order): RepeatLocation {
  const latitude = order.address_latitude ?? order.store_latitude ?? null;
  const longitude = order.address_longitude ?? order.store_longitude ?? null;
  return {
    customer_latitude: latitude,
    customer_longitude: longitude
  };
}

export async function repeatOrderIntoCart(token: string, order: Order): Promise<RepeatOrderResult> {
  const location = repeatLocationForOrder(order);
  const failedItemNames: string[] = [];
  const priceChangedItemNames: string[] = [];
  let cart: Cart | null = null;
  let addedItemCount = 0;

  for (const item of order.items) {
    if (item.product_id === null) {
      failedItemNames.push(item.product_name);
      continue;
    }

    try {
      cart = await addCartItem(token, {
        store_id: order.store_id,
        product_id: item.product_id,
        quantity: item.quantity,
        note: item.note,
        ...location
      });
      addedItemCount += item.quantity;

      const cartItem = cart.items.find((nextItem) => nextItem.product_id === item.product_id);
      if (cartItem && pricesDiffer(cartItem.unit_price, item.unit_price)) {
        priceChangedItemNames.push(cartItem.product_name);
      }
    } catch {
      failedItemNames.push(item.product_name);
    }
  }

  let deliveryModeWarning = false;
  if (cart) {
    try {
      cart = await updateCart(token, order.delivery_mode, location);
    } catch {
      deliveryModeWarning = true;
    }
  }

  return {
    cart,
    addedItemCount,
    failedItemNames,
    priceChangedItemNames: Array.from(new Set(priceChangedItemNames)),
    deliveryModeWarning
  };
}

export function repeatOrderFeedback(result: RepeatOrderResult) {
  if (result.addedItemCount === 0) {
    return {
      title: "No se pudo repetir el pedido",
      message: "Los productos del pedido ya no estan disponibles o no se pudieron agregar con los precios actuales.",
      variant: "danger" as const
    };
  }

  const details = [`Agregamos ${result.addedItemCount} ${result.addedItemCount === 1 ? "producto" : "productos"} al carrito.`];

  if (result.priceChangedItemNames.length) {
    details.push("Actualizamos los precios segun el catalogo vigente.");
  }

  if (result.failedItemNames.length) {
    details.push(`No se agregaron: ${result.failedItemNames.slice(0, 3).join(", ")}.`);
  }

  if (result.deliveryModeWarning) {
    details.push("Revisa la modalidad de entrega antes de confirmar.");
  }

  return {
    title: result.priceChangedItemNames.length ? "Pedido repetido con precios actualizados" : "Pedido repetido",
    message: details.join(" "),
    variant: result.priceChangedItemNames.length || result.failedItemNames.length || result.deliveryModeWarning ? ("warning" as const) : ("success" as const)
  };
}
