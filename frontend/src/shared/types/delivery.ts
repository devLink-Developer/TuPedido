import type { Order } from "./order";

export type DeliveryVehicleType = "bicycle" | "motorcycle" | "car";
export type DeliveryAvailability = "offline" | "idle" | "reserved" | "delivering" | "paused";

export type DeliveryApplication = {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  phone: string;
  vehicle_type: DeliveryVehicleType;
  photo_url: string | null;
  dni_number: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  license_number: string | null;
  vehicle_plate: string | null;
  insurance_policy: string | null;
  notes: string | null;
  status: "pending_review" | "approved" | "rejected" | "suspended";
  review_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DeliveryApplicationCreate = {
  phone: string;
  vehicle_type: DeliveryVehicleType;
  photo_url?: string | null;
  dni_number: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  license_number?: string | null;
  vehicle_plate?: string | null;
  insurance_policy?: string | null;
  notes?: string | null;
};

export type AdminRiderCreate = {
  full_name: string;
  email: string;
  password: string;
  phone: string;
  vehicle_type: DeliveryVehicleType;
  dni_number: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  photo_url?: string | null;
  license_number?: string | null;
  vehicle_plate?: string | null;
  insurance_policy?: string | null;
  notes?: string | null;
  review_notes?: string | null;
  current_zone_id?: number | null;
  availability?: DeliveryAvailability;
  is_active?: boolean;
};

export type DeliveryProfile = {
  user_id: number;
  full_name: string;
  email: string;
  phone: string;
  vehicle_type: DeliveryVehicleType;
  availability: DeliveryAvailability;
  is_active: boolean;
  current_zone_id: number | null;
  current_latitude: number | null;
  current_longitude: number | null;
  last_location_at: string | null;
  completed_deliveries: number;
  rating: number;
  push_enabled: boolean;
};

export type DeliveryZoneRate = {
  vehicle_type: DeliveryVehicleType;
  delivery_fee_customer: number;
  rider_fee: number;
};

export type DeliveryZone = {
  id: number;
  name: string;
  description: string | null;
  center_latitude: number;
  center_longitude: number;
  radius_km: number;
  is_active: boolean;
  rates: DeliveryZoneRate[];
};

export type DeliveryZoneWrite = Omit<DeliveryZone, "id">;

export type DeliverySettlement = {
  rider_user_id: number;
  rider_name: string;
  vehicle_type: string;
  cash_liability_total: number;
  cash_liability_open: number;
  rider_fee_earned_total: number;
  rider_fee_paid_total: number;
  merchant_cash_payable_total?: number;
};

export type DeliverySettlementPaymentCreate = {
  rider_user_id: number;
  amount: number;
  paid_at: string;
  reference?: string | null;
  notes?: string | null;
};

export type DeliveryOrder = Order;
