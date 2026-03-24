import type { LegacyAddress, LegacyProduct, LegacyRestaurant, MenuCategory } from "./types";

export const restaurants: LegacyRestaurant[] = [
  {
    id: "1",
    slug: "pizza-paradise",
    name: "Pizza Paradise",
    cuisine: "Pizza y pastas",
    description: "Promos nocturnas, masa madre y combos pensados para delivery.",
    eta: "20-35 min",
    rating: 4.8,
    deliveryFee: "Gratis",
    coverImage: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1200&q=80",
    accent: "from-orange-500 via-orange-400 to-amber-200"
  },
  {
    id: "2",
    slug: "burger-palace",
    name: "Burger Palace",
    cuisine: "Americana",
    description: "Hamburguesas premium, sides XL y entrega express para móviles.",
    eta: "25-35 min",
    rating: 4.7,
    deliveryFee: "$ 2.99",
    coverImage: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1200&q=80",
    accent: "from-zinc-900 via-orange-700 to-orange-300"
  },
  {
    id: "3",
    slug: "green-market",
    name: "Green Market",
    cuisine: "Healthy y bowls",
    description: "Opciones rápidas, bowls, wraps y bebidas frías.",
    eta: "18-28 min",
    rating: 4.9,
    deliveryFee: "Gratis",
    coverImage: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=80",
    accent: "from-lime-700 via-emerald-500 to-amber-100"
  }
];

export const menuCategories: MenuCategory[] = [
  { id: "featured", name: "Populares" },
  { id: "burgers", name: "Hamburguesas" },
  { id: "sides", name: "Acompaniamientos" },
  { id: "drinks", name: "Bebidas" }
];

export const products: LegacyProduct[] = [
  {
    id: "1",
    restaurantId: "2",
    categoryId: "featured",
    name: "Palace Double Cheddar",
    description: "Doble carne, cheddar fundido y salsa de la casa.",
    price: 12.5
  },
  {
    id: "2",
    restaurantId: "2",
    categoryId: "burgers",
    name: "Bacon Lovers BBQ",
    description: "Bacon crocante, cebolla crispy y BBQ artesanal.",
    price: 10.99
  },
  {
    id: "3",
    restaurantId: "2",
    categoryId: "sides",
    name: "Papas Rusticas XL",
    description: "Papas con especias y dip cheddar.",
    price: 4.5
  },
  {
    id: "4",
    restaurantId: "2",
    categoryId: "drinks",
    name: "Limonada de jengibre",
    description: "Citrica, fresca y pensada para combos.",
    price: 3.75
  },
  {
    id: "5",
    restaurantId: "1",
    categoryId: "featured",
    name: "Napolitana grande",
    description: "Mozzarella, tomate fresco y albahaca.",
    price: 14.25
  },
  {
    id: "6",
    restaurantId: "3",
    categoryId: "featured",
    name: "Bowl Green Boost",
    description: "Quinoa, pollo grillado y palta.",
    price: 11.4
  }
];

export const addresses: LegacyAddress[] = [
  {
    id: "addr-1",
    label: "Casa",
    street: "Av. Corrientes 1234",
    details: "Piso 8, Depto B, CABA",
    isDefault: true
  },
  {
    id: "addr-2",
    label: "Trabajo",
    street: "Av. del Libertador 7300",
    details: "Recepcion principal",
    isDefault: false
  }
];
