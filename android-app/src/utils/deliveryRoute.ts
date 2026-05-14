import { colors } from "../theme";
import type { Order, OrderTracking, RouteCoordinate, RouteProfile } from "../types/api";

export type DeliveryRoutePhase = "pickup" | "dropoff";

export function isTerminalDeliveryOrder(order: Order | null | undefined): boolean {
  return !order || ["delivered", "cancelled", "delivery_failed"].includes(order.status);
}

export function shouldAutoShareDeliveryLocation(order: Order | null | undefined): boolean {
  if (!order || order.delivery_mode !== "delivery" || isTerminalDeliveryOrder(order)) return false;
  return ["assigned", "heading_to_store", "picked_up", "near_customer"].includes(order.delivery_status);
}

export function deliveryRoutePhase(order: Order): DeliveryRoutePhase {
  if (order.status === "out_for_delivery" || ["picked_up", "near_customer"].includes(order.delivery_status)) {
    return "dropoff";
  }
  return "pickup";
}

export function deliveryRouteTitle(order: Order): string {
  return deliveryRoutePhase(order) === "dropoff" ? "Ruta al cliente" : "Ruta al comercio";
}

export function deliveryRouteDestinationLabel(order: Order): string {
  return deliveryRoutePhase(order) === "dropoff" ? "Cliente" : "Comercio";
}

export function routeProfileForVehicle(vehicle: string | null | undefined): RouteProfile {
  if (vehicle === "bicycle") return "cycling-regular";
  return "driving-car";
}

function preserveInitialCase(match: string, replacement: string): string {
  return match[0] === match[0].toUpperCase()
    ? `${replacement[0].toUpperCase()}${replacement.slice(1)}`
    : replacement;
}

export function normalizeRiderInstructionText(instruction: string): string {
  return instruction
    .replace(/\bcamina\b/gi, (match) => preserveInitialCase(match, "avanza"))
    .replace(/\bcamine\b/gi, (match) => preserveInitialCase(match, "avance"))
    .replace(/\bcaminar\b/gi, (match) => preserveInitialCase(match, "avanzar"))
    .replace(/\bcaminando\b/gi, (match) => preserveInitialCase(match, "avanzando"));
}

export function toRouteCoordinate(latitude: number | null | undefined, longitude: number | null | undefined): RouteCoordinate | null {
  if (typeof latitude !== "number" || typeof longitude !== "number") return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

export function getRiderCoordinate(order: Order, tracking: OrderTracking | null): RouteCoordinate | null {
  return toRouteCoordinate(
    tracking?.tracking_last_latitude ?? order.tracking_last_latitude,
    tracking?.tracking_last_longitude ?? order.tracking_last_longitude
  );
}

export function getStoreCoordinate(order: Order): RouteCoordinate | null {
  return toRouteCoordinate(order.store_latitude, order.store_longitude);
}

export function getAddressCoordinate(order: Order): RouteCoordinate | null {
  return toRouteCoordinate(order.address_latitude, order.address_longitude);
}

export function getRouteDestination(order: Order): RouteCoordinate | null {
  return deliveryRoutePhase(order) === "dropoff" ? getAddressCoordinate(order) : getStoreCoordinate(order);
}

export function getRouteOrigin(order: Order, tracking: OrderTracking | null): RouteCoordinate | null {
  return getRiderCoordinate(order, tracking) ?? getStoreCoordinate(order);
}

export function getDeliveryRoutePoints(order: Order, tracking: OrderTracking | null) {
  return [
    {
      id: "rider",
      label: "Tu ubicacion",
      latitude: tracking?.tracking_last_latitude ?? order.tracking_last_latitude,
      longitude: tracking?.tracking_last_longitude ?? order.tracking_last_longitude,
      color: colors.accent
    },
    { id: "store", label: "Comercio", latitude: order.store_latitude, longitude: order.store_longitude, color: colors.primary },
    { id: "address", label: "Cliente", latitude: order.address_latitude, longitude: order.address_longitude, color: colors.success }
  ];
}
