import type { ApiDiagnostic } from "../services/api/client";

const KNOWN_MESSAGES: Array<[RegExp, string]> = [
  [
    /cart already contains products from another store/i,
    "Tu carrito tiene productos de otro comercio. Vacialo o finalizá ese pedido antes de agregar productos de este local."
  ],
  [/invalid credentials|incorrect email|wrong password|credenciales/i, "Email o contraseña incorrectos."],
  [/already registered|already exists|email.*exists|duplicate/i, "Ya existe una cuenta con ese email."],
  [/invalid delivery otp|invalid otp|otp/i, "El código de entrega no es correcto. Revisalo con el cliente e intentá nuevamente."],
  [/order review is not available yet/i, "La calificación se habilita 10 minutos después de recibir el pedido."],
  [/store is closed|not accepting orders/i, "El comercio no está recibiendo pedidos en este momento."],
  [/outside this store coverage area|fuera de cobertura|no llega/i, "El comercio no llega a esa direccion."],
  [/product.*not.*available|unavailable/i, "Ese producto no está disponible en este momento."],
  [/unauthorized|invalid token|missing bearer|not authenticated/i, "Tu sesión venció. Iniciá sesión nuevamente para continuar."],
  [/forbidden|not authorized|permission denied/i, "No tenés permiso para realizar esta acción."],
  [/network request failed|failed to fetch|network error/i, "No pudimos conectar con KePedimos. Revisá tu conexión e intentá de nuevo."],
  [/timeout|timed out/i, "La conexión tardó más de lo esperado. Intentá nuevamente."]
];

export function friendlyErrorMessage(error: unknown, fallback = "Intentá nuevamente."): string {
  const raw = error instanceof Error ? error.message : String(error || "");
  const normalized = raw.trim();
  if (!normalized) return fallback;
  const known = KNOWN_MESSAGES.find(([pattern]) => pattern.test(normalized));
  if (known) return known[1];

  const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: unknown }).status) : null;
  if (status === 0 && /tardo|timeout|timed out/i.test(normalized)) return "La conexión tardó más de lo esperado. Intentá nuevamente.";
  if (status === 0) return "No pudimos conectar con KePedimos. Revisá tu conexión e intentá de nuevo.";
  if (status === 400 || status === 409 || status === 422) return normalized;
  if (status === 401) return "Tu sesión venció. Iniciá sesión nuevamente para continuar.";
  if (status === 403) return "No tenés permiso para realizar esta acción.";
  if (status === 404) return "No encontramos la información solicitada.";
  if (status && status >= 500) return "El servicio no respondió correctamente. Intentá nuevamente en unos minutos.";
  if (/^request failed \(\d+\)$/i.test(normalized)) return fallback;

  return normalized;
}

function pickDiagnostics(error: unknown): Partial<ApiDiagnostic> | null {
  if (!error || typeof error !== "object" || !("diagnostics" in error)) return null;
  const diagnostics = (error as { diagnostics?: Partial<ApiDiagnostic> }).diagnostics;
  return diagnostics && typeof diagnostics === "object" ? diagnostics : null;
}

export function formatApiDiagnostic(error: unknown): string | null {
  const diagnostics = pickDiagnostics(error);
  if (!diagnostics) return null;

  const parts = [
    diagnostics.method && diagnostics.path ? `${diagnostics.method} ${diagnostics.path}` : diagnostics.path ?? diagnostics.url,
    typeof diagnostics.status === "number" ? `HTTP ${diagnostics.status}` : null,
    typeof diagnostics.elapsedMs === "number" ? `${Math.round(diagnostics.elapsedMs)}ms` : null,
    diagnostics.nativeError ? `error: ${diagnostics.nativeError}` : null,
    diagnostics.appVersion ? `app ${diagnostics.appVersion} (${diagnostics.appBuildNumber ?? "?"})` : null
  ].filter(Boolean);

  return parts.length ? `Diagnostico: ${parts.join(" | ")}` : null;
}

export function withApiDiagnostic(message: string, error: unknown, runtimeLabel?: string): string {
  return [message, formatApiDiagnostic(error), runtimeLabel].filter(Boolean).join("\n\n");
}
