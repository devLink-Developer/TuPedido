export const CUSTOMER_ADDRESSES_CHANGED_EVENT = "customer-addresses-changed";

export function notifyCustomerAddressesChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CUSTOMER_ADDRESSES_CHANGED_EVENT));
}
