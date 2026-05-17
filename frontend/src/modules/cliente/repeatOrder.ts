import type { Cart, Order } from "../../shared/types";

type RepeatOrderCartActions = {
  addItem: (payload: {
    storeId: number;
    productId: number;
    quantity?: number;
    note?: string | null;
    customerLatitude?: number | null;
    customerLongitude?: number | null;
  }) => Promise<Cart>;
  setDeliveryMode: (mode: "delivery" | "pickup", location?: { latitude: number; longitude: number } | null) => Promise<void>;
};

export type RepeatOrderResult = {
  addedItemCount: number;
  failedItemNames: string[];
  priceChangedItemNames: string[];
  deliveryModeWarning: boolean;
};

function pricesDiffer(left: number, right: number) {
  return Math.abs(left - right) >= 0.01;
}

function repeatLocationForOrder(order: Order) {
  const latitude = order.address_latitude ?? order.store_latitude ?? null;
  const longitude = order.address_longitude ?? order.store_longitude ?? null;
  return {
    latitude,
    longitude,
    location: typeof latitude === "number" && typeof longitude === "number" ? { latitude, longitude } : null
  };
}

export async function repeatOrderIntoCart(order: Order, cartActions: RepeatOrderCartActions): Promise<RepeatOrderResult> {
  const { latitude, longitude, location } = repeatLocationForOrder(order);
  const failedItemNames: string[] = [];
  const priceChangedItemNames: string[] = [];
  let addedItemCount = 0;
  let addedAnyItem = false;

  for (const item of order.items) {
    if (item.product_id === null) {
      failedItemNames.push(item.product_name);
      continue;
    }

    try {
      const cart = await cartActions.addItem({
        storeId: order.store_id,
        productId: item.product_id,
        quantity: item.quantity,
        note: item.note,
        customerLatitude: latitude,
        customerLongitude: longitude
      });
      addedAnyItem = true;
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
  if (addedAnyItem) {
    try {
      await cartActions.setDeliveryMode(order.delivery_mode, location);
    } catch {
      deliveryModeWarning = true;
    }
  }

  return {
    addedItemCount,
    failedItemNames,
    priceChangedItemNames: Array.from(new Set(priceChangedItemNames)),
    deliveryModeWarning
  };
}

export function repeatOrderMessage(result: RepeatOrderResult) {
  if (result.addedItemCount === 0) {
    return "No se pudo repetir el pedido con los precios actuales.";
  }

  const details = [`${result.addedItemCount} ${result.addedItemCount === 1 ? "producto agregado" : "productos agregados"} al carrito.`];

  if (result.priceChangedItemNames.length) {
    details.push("Precios actualizados segun catalogo vigente.");
  }

  if (result.failedItemNames.length) {
    details.push(`No se agregaron: ${result.failedItemNames.slice(0, 3).join(", ")}.`);
  }

  if (result.deliveryModeWarning) {
    details.push("Revisa la modalidad de entrega antes de confirmar.");
  }

  return details.join(" ");
}
