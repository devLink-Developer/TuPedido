import { useCartStore } from "../stores";

export function useCart() {
  const cart = useCartStore((state) => state.cart);
  const loading = useCartStore((state) => state.loading);
  const error = useCartStore((state) => state.error);
  const refreshCart = useCartStore((state) => state.refreshCart);
  const resetCart = useCartStore((state) => state.reset);
  const setDeliveryMode = useCartStore((state) => state.setDeliveryMode);
  const addItem = useCartStore((state) => state.addItem);
  const updateItem = useCartStore((state) => state.updateItem);
  const removeItem = useCartStore((state) => state.removeItem);
  const clear = useCartStore((state) => state.clear);

  const items = cart?.items ?? [];

  return {
    cart,
    items,
    loading,
    error,
    refreshCart,
    resetCart,
    setDeliveryMode,
    addItem,
    updateItem,
    removeItem,
    clear,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: cart?.pricing.subtotal ?? 0,
    deliveryFee: cart?.pricing.deliveryFee ?? 0,
    serviceFee: cart?.pricing.serviceFee ?? 0,
    total: cart?.pricing.total ?? 0,
    storeId: cart?.store_id ?? null,
    storeSlug: cart?.store_slug ?? null,
    storeName: cart?.store_name ?? null,
    deliveryMode: cart?.delivery_mode ?? "delivery"
  };
}
