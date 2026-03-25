import type { Role } from "../types";

export const roleToHomePath: Record<Role, string> = {
  customer: "/c",
  merchant: "/m",
  delivery: "/r",
  admin: "/a"
};

export function normalizePath(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
}
