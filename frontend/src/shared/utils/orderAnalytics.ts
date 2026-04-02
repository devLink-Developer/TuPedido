import type { Order } from "../types";

export type OrderPeriodStats = {
  sales: number;
  orderCount: number;
  deliveredCount: number;
  averageTicket: number;
  cancellationCount: number;
  serviceFeeTotal: number;
};

export type NamedOrderPeriodStats = {
  key: "today" | "week" | "month";
  label: string;
  stats: OrderPeriodStats;
};

const DEFAULT_STATS: OrderPeriodStats = {
  sales: 0,
  orderCount: 0,
  deliveredCount: 0,
  averageTicket: 0,
  cancellationCount: 0,
  serviceFeeTotal: 0
};

export const ORDER_STATUS_PRIORITY: Record<string, number> = {
  created: 0,
  accepted: 1,
  preparing: 2,
  ready_for_dispatch: 3,
  ready_for_pickup: 3,
  assignment_pending: 4,
  assigned: 5,
  heading_to_store: 6,
  picked_up: 7,
  near_customer: 8,
  out_for_delivery: 9,
  delivery_failed: 10,
  delivered: 98,
  cancelled: 99
};

export const orderStateTone: Record<string, string> = {
  created: "border-sky-200 bg-sky-50 text-sky-900",
  accepted: "border-indigo-200 bg-indigo-50 text-indigo-900",
  preparing: "border-amber-200 bg-amber-50 text-amber-900",
  ready_for_dispatch: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900",
  ready_for_pickup: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900",
  assignment_pending: "border-orange-200 bg-orange-50 text-orange-900",
  assigned: "border-violet-200 bg-violet-50 text-violet-900",
  heading_to_store: "border-purple-200 bg-purple-50 text-purple-900",
  picked_up: "border-cyan-200 bg-cyan-50 text-cyan-900",
  near_customer: "border-teal-200 bg-teal-50 text-teal-900",
  out_for_delivery: "border-emerald-200 bg-emerald-50 text-emerald-900",
  delivered: "border-emerald-200 bg-emerald-100 text-emerald-950",
  cancelled: "border-rose-200 bg-rose-50 text-rose-900",
  delivery_failed: "border-rose-200 bg-rose-50 text-rose-900"
};

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfWeek(date: Date) {
  const next = startOfDay(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  return next;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function toDate(value: string) {
  return new Date(value);
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0);
}

function buildStats(orders: Order[]): OrderPeriodStats {
  if (!orders.length) {
    return DEFAULT_STATS;
  }
  const sales = orders.reduce((sum, order) => sum + order.total, 0);
  const deliveredCount = orders.filter((order) => order.status === "delivered").length;
  const cancellationCount = orders.filter((order) => order.status === "cancelled").length;
  const serviceFeeTotal = orders.reduce((sum, order) => sum + order.service_fee, 0);
  return {
    sales,
    orderCount: orders.length,
    deliveredCount,
    averageTicket: sales / orders.length,
    cancellationCount,
    serviceFeeTotal
  };
}

function filterRange(orders: Order[], start: Date, end: Date) {
  return orders.filter((order) => {
    const createdAt = toDate(order.created_at);
    return createdAt >= start && createdAt < end;
  });
}

export function buildNamedPeriodStats(orders: Order[], now = new Date()): NamedOrderPeriodStats[] {
  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);
  return [
    {
      key: "today",
      label: "Hoy",
      stats: buildStats(filterRange(orders, todayStart, addDays(todayStart, 1)))
    },
    {
      key: "week",
      label: "Semana",
      stats: buildStats(filterRange(orders, weekStart, addDays(weekStart, 7)))
    },
    {
      key: "month",
      label: "Mes",
      stats: buildStats(filterRange(orders, monthStart, addMonths(monthStart, 1)))
    }
  ];
}

export function localDateKey(value: string): string {
  const date = toDate(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatOrderDateHeading(value: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(parseDateKey(value));
}

export function isHiddenOrderByDefault(order: Order): boolean {
  return order.status === "cancelled" || order.status === "delivered";
}

export function compareOperationalOrders(left: Order, right: Order): number {
  const leftDateKey = localDateKey(left.created_at);
  const rightDateKey = localDateKey(right.created_at);
  if (leftDateKey !== rightDateKey) {
    return leftDateKey < rightDateKey ? 1 : -1;
  }

  const leftPriority = ORDER_STATUS_PRIORITY[left.status] ?? 50;
  const rightPriority = ORDER_STATUS_PRIORITY[right.status] ?? 50;
  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  const leftDate = toDate(left.created_at).getTime();
  const rightDate = toDate(right.created_at).getTime();
  return rightDate - leftDate;
}

export function groupOrdersByDate(orders: Order[]): Array<{ dateKey: string; label: string; orders: Order[] }> {
  const groups = new Map<string, Order[]>();
  for (const order of [...orders].sort(compareOperationalOrders)) {
    const dateKey = localDateKey(order.created_at);
    const current = groups.get(dateKey) ?? [];
    current.push(order);
    groups.set(dateKey, current);
  }
  return [...groups.entries()].map(([dateKey, groupedOrders]) => ({
    dateKey,
    label: formatOrderDateHeading(dateKey),
    orders: groupedOrders
  }));
}
