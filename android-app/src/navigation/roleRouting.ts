import type { Role } from "../types/api";

export type AppHome = "CustomerTabs" | "DeliveryTabs" | "UnsupportedRole";

export function homeForRole(role: Role | null | undefined): AppHome {
  if (role === "customer") return "CustomerTabs";
  if (role === "delivery") return "DeliveryTabs";
  return "UnsupportedRole";
}

export function canUseCustomerApp(role: Role | null | undefined): boolean {
  return role === "customer";
}

export function canUseDeliveryApp(role: Role | null | undefined): boolean {
  return role === "delivery";
}
