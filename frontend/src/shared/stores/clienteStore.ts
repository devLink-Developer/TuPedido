import { create } from "zustand";

type DeliveryModeFilter = "" | "delivery" | "pickup";

type ClienteState = {
  categorySlug: string;
  search: string;
  deliveryMode: DeliveryModeFilter;
  selectedAddressId: number | "";
  selectedPaymentMethod: "cash" | "mercadopago";
  setCategorySlug: (value: string) => void;
  setSearch: (value: string) => void;
  setDeliveryMode: (value: DeliveryModeFilter) => void;
  setSelectedAddressId: (value: number | "") => void;
  setSelectedPaymentMethod: (value: "cash" | "mercadopago") => void;
  resetCheckout: () => void;
  resetCatalog: () => void;
};

export const useClienteStore = create<ClienteState>((set) => ({
  categorySlug: "",
  search: "",
  deliveryMode: "",
  selectedAddressId: "",
  selectedPaymentMethod: "cash",
  setCategorySlug(value) {
    set({ categorySlug: value });
  },
  setSearch(value) {
    set({ search: value });
  },
  setDeliveryMode(value) {
    set({ deliveryMode: value });
  },
  setSelectedAddressId(value) {
    set({ selectedAddressId: value });
  },
  setSelectedPaymentMethod(value) {
    set({ selectedPaymentMethod: value });
  },
  resetCheckout() {
    set({
      selectedAddressId: "",
      selectedPaymentMethod: "cash"
    });
  },
  resetCatalog() {
    set({
      categorySlug: "",
      search: "",
      deliveryMode: ""
    });
  }
}));
