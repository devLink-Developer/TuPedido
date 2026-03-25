export type Role = "customer" | "merchant" | "admin" | "delivery";

export type AppNotification = {
  id: number;
  order_id: number | null;
  channel: string;
  event_type: string;
  title: string;
  body: string;
  payload_json: string | null;
  is_read: boolean;
  push_status: string;
  created_at: string;
};

export type PushSubscriptionPayload = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  user_agent?: string | null;
};
