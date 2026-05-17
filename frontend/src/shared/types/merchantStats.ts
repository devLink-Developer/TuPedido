import type { SettlementOverview } from "./merchant";

export type MerchantStatsComparison = "previous_period" | "same_week_previous" | "same_month_previous";

export type MerchantStatsQuery = {
  startDate: string;
  endDate: string;
  comparison: MerchantStatsComparison;
};

export type MerchantStatsPeriod = {
  start_date: string;
  end_date: string;
  comparison: MerchantStatsComparison;
  compare_start_date: string;
  compare_end_date: string;
};

export type MerchantStatsInsight = {
  tone: "neutral" | "success" | "warning" | "danger";
  title: string;
  description: string;
};

export type MerchantStatsOverview = {
  period: MerchantStatsPeriod;
  kpis: {
    gross_sales: number;
    net_sales: number;
    gross_sales_change_pct: number;
    net_sales_change_pct: number;
    total_orders: number;
    total_orders_change_pct: number;
    delivered_orders: number;
    cancelled_orders: number;
    rejected_orders: number;
    average_ticket: number;
    average_ticket_change_pct: number;
    unique_customers: number;
    repeat_rate: number;
    avg_preparation_minutes: number;
    avg_delivery_minutes: number;
    cancellation_rate: number;
    cancellation_rate_change_pct: number;
  };
  insights: MerchantStatsInsight[];
};

export type MerchantStatsSales = {
  period: MerchantStatsPeriod;
  daily: Array<{
    date: string;
    label: string;
    gross_sales: number;
    net_sales: number;
    orders: number;
    delivered_orders: number;
    average_ticket: number;
  }>;
  hourly: Array<{
    hour: number;
    label: string;
    orders: number;
    gross_sales: number;
  }>;
  weekdays: Array<{
    weekday: number;
    label: string;
    orders: number;
    gross_sales: number;
    average_ticket: number;
  }>;
};

export type MerchantStatsProducts = {
  period: MerchantStatsPeriod;
  top_products: Array<{
    product_id: number | null;
    product_name: string;
    quantity_sold: number;
    revenue: number;
    margin: number;
    trend_pct: number;
  }>;
  low_performance: Array<{
    product_id: number | null;
    product_name: string;
    reason: string;
    recommendation: string;
    severity: "neutral" | "warning" | "danger";
  }>;
};

export type MerchantStatsCustomers = {
  period: MerchantStatsPeriod;
  new_vs_recurrent: {
    new_customers: number;
    recurrent_customers: number;
  };
  top_customers: Array<{
    customer_id: number;
    customer_name: string;
    orders: number;
    total_spent: number;
    frequency_days: number | null;
  }>;
  frequency: {
    average_days_between_orders: number;
  };
};

export type MerchantStatsDelivery = {
  period: MerchantStatsPeriod;
  riders: Array<{
    rider_user_id: number;
    rider_name: string;
    delivered_orders: number;
    cancelled_orders: number;
    generated_revenue: number;
    avg_delivery_minutes: number;
  }>;
  zones: Array<{
    zone: string;
    orders: number;
  }>;
  distance: {
    average_km: number;
  };
  costs: {
    delivery_charged: number;
    rider_cost: number;
    subsidized: number;
    profit: number;
  };
};

export type MerchantStatsFinancial = {
  period: MerchantStatsPeriod;
  settlements: SettlementOverview;
  payment_methods: Array<{
    method: "cash" | "mercadopago" | "transfer" | string;
    orders: number;
    total: number;
  }>;
  cashflow: Array<{
    date: string;
    label: string;
    revenue: number;
    service_fees: number;
    delivery_cost: number;
    net_cash: number;
  }>;
};
