import type { Role } from "../types";

export const dayNames = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

export const paymentMethodLabels: Record<string, string> = {
  cash: "Efectivo",
  mercadopago: "Mercado Pago"
};

export const statusLabels: Record<string, string> = {
  created: "Creado",
  accepted: "Aceptado",
  preparing: "Preparando",
  ready_for_dispatch: "Listo para despacho",
  ready_for_pickup: "Listo para retirar",
  assignment_pending: "Buscando rider",
  assigned: "Rider asignado",
  heading_to_store: "Yendo al comercio",
  picked_up: "Retirado",
  near_customer: "Cerca del cliente",
  out_for_delivery: "En camino",
  delivered: "Entregado",
  delivery_failed: "Entrega fallida",
  cancelled: "Cancelado",
  pending: "Pendiente",
  pending_review: "Pendiente de revisión",
  approved: "Aprobado",
  rejected: "Rechazado",
  suspended: "Suspendido",
  offline: "Offline",
  idle: "Disponible",
  paused: "Pausa",
  reserved: "Reservado",
  delivering: "Repartiendo"
};

export const orderStatusOptions = [
  "created",
  "accepted",
  "preparing",
  "ready_for_dispatch",
  "ready_for_pickup",
  "out_for_delivery",
  "delivered",
  "cancelled"
] as const;

export const roleLabels: Record<Role, string> = {
  customer: "Cliente",
  merchant: "Comercio",
  delivery: "Rider",
  admin: "Admin"
};
