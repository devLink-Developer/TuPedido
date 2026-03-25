export function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2
  }).format(value ?? 0);
}

export function formatHour(value: string | null) {
  return value ? value.slice(0, 5) : "";
}

export function timeFromInput(value: string) {
  return value.length === 5 ? `${value}:00` : value;
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleString("es-AR");
}
