export const paymentMethodLabels: Record<string, string> = {
  cash: "Efectivo",
  mercadopago: "Mercado Pago",
  mercado_pago: "Mercado Pago",
  card: "Tarjeta",
  debit_card: "Tarjeta de débito",
  credit_card: "Tarjeta de crédito",
  transfer: "Transferencia"
};

export const statusLabels: Record<string, string> = {
  created: "Recibido",
  accepted: "Aceptado",
  preparing: "En preparación",
  ready_for_dispatch: "Listo para enviar",
  ready_for_pickup: "Listo para retirar",
  assignment_pending: "Buscando repartidor",
  assigned: "Repartidor asignado",
  heading_to_store: "Yendo al comercio",
  picked_up: "Retirado",
  near_customer: "Cerca del cliente",
  out_for_delivery: "En camino",
  delivered: "Entregado",
  delivery_failed: "No se pudo entregar",
  cancelled: "Cancelado",
  pending: "Pendiente",
  processing: "Procesando",
  approved: "Aprobado",
  rejected: "Rechazado",
  refunded: "Reembolsado",
  chargeback: "Contracargo",
  offline: "Desconectado",
  idle: "Disponible",
  reserved: "Reservado",
  delivering: "Entregando",
  paused: "Pausado",
  unassigned: "Sin repartidor",
  paid: "Pagado",
  failed: "Fallido"
};

function humanizeLabel(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/^\p{L}/u, (letter) => letter.toUpperCase());
}

export function labelForStatus(value: string | null | undefined): string {
  if (!value) return "Estado pendiente";
  return statusLabels[value] ?? humanizeLabel(value);
}

export function labelForPaymentMethod(value: string | null | undefined): string {
  if (!value) return "Medio de pago pendiente";
  return paymentMethodLabels[value] ?? humanizeLabel(value);
}
