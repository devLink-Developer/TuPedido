import { create } from "zustand";

type DeliveryModeFilter = "" | "delivery" | "pickup";

export type CustomerLocation = {
  latitude: number;
  longitude: number;
  source: "address" | "gps";
};

type ClienteState = {
  categorySlug: string;
  search: string;
  deliveryMode: DeliveryModeFilter;
  selectedAddressId: number | "";
  selectedPaymentMethod: "cash" | "mercadopago";
  customerLocation: CustomerLocation | null;
  setCategorySlug: (value: string) => void;
  setSearch: (value: string) => void;
  setDeliveryMode: (value: DeliveryModeFilter) => void;
  setSelectedAddressId: (value: number | "") => void;
  setSelectedPaymentMethod: (value: "cash" | "mercadopago") => void;
  setCustomerLocation: (value: CustomerLocation | null) => void;
  resetCheckout: () => void;
  resetCatalog: () => void;
};

export const useClienteStore = create<ClienteState>((set) => ({
  categorySlug: "",
  search: "",
  deliveryMode: "",
  selectedAddressId: "",
  selectedPaymentMethod: "cash",
  customerLocation: null,
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
  setCustomerLocation(value) {
    set({ customerLocation: value });
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
