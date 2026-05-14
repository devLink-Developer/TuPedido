import type { Role } from "../types";

export const roleToHomePath: Record<Role, string> = {
  customer: "/c",
  merchant: "/m",
  delivery: "/r",
  admin: "/a"
};

function currentOrigin() {
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin;
  }
  return "https://kepedimos.com";
}

export function normalizePath(url: string) {
  try {
    const parsed = new URL(url, currentOrigin());
    if (parsed.origin !== currentOrigin()) {
      return url;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
}
