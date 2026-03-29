from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


VehicleType = Literal["bicycle", "motorcycle", "car"]
DeliveryAvailability = Literal["offline", "idle", "reserved", "delivering", "paused"]
DeliveryApplicationStatus = Literal["pending_review", "approved", "rejected", "suspended"]


class DeliveryApplicationCreate(BaseModel):
    phone: str
    vehicle_type: VehicleType
    photo_url: str | None = None
    dni_number: str
    emergency_contact_name: str
    emergency_contact_phone: str
    license_number: str | None = None
    vehicle_plate: str | None = None
    insurance_policy: str | None = None
    notes: str | None = None


class DeliveryApplicationReview(BaseModel):
    status: DeliveryApplicationStatus
    review_notes: str | None = None


class DeliveryApplicationRead(BaseModel):
    id: int
    user_id: int
    store_id: int | None = None
    store_name: str | None = None
    user_name: str
    user_email: str
    phone: str
    vehicle_type: VehicleType
    photo_url: str | None = None
    dni_number: str
    emergency_contact_name: str
    emergency_contact_phone: str
    license_number: str | None = None
    vehicle_plate: str | None = None
    insurance_policy: str | None = None
    notes: str | None = None
    status: DeliveryApplicationStatus
    review_notes: str | None = None
    reviewed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class DeliveryAvailabilityUpdate(BaseModel):
    availability: DeliveryAvailability
    zone_id: int | None = None


class DeliveryLocationUpdate(BaseModel):
    order_id: int
    latitude: float
    longitude: float
    heading: float | None = None
    speed_kmh: float | None = None
    accuracy_meters: float | None = None


class DeliveryDeliverRequest(BaseModel):
    otp_code: str | None = None


class DeliveryAssignRequest(BaseModel):
    rider_user_id: int


class DeliveryZoneRateWrite(BaseModel):
    vehicle_type: VehicleType
    delivery_fee_customer: float = Field(ge=0)
    rider_fee: float = Field(ge=0)


class DeliveryZoneWrite(BaseModel):
    name: str
    description: str | None = None
    center_latitude: float
    center_longitude: float
    radius_km: float = Field(gt=0)
    is_active: bool = True
    rates: list[DeliveryZoneRateWrite]


class DeliveryZoneRead(BaseModel):
    id: int
    name: str
    description: str | None = None
    center_latitude: float
    center_longitude: float
    radius_km: float
    is_active: bool
    rates: list[DeliveryZoneRateWrite]


class DeliveryProfileRead(BaseModel):
    user_id: int
    store_id: int | None = None
    store_name: str | None = None
    full_name: str
    email: str
    phone: str
    vehicle_type: VehicleType
    photo_url: str | None = None
    dni_number: str
    emergency_contact_name: str
    emergency_contact_phone: str
    license_number: str | None = None
    vehicle_plate: str | None = None
    insurance_policy: str | None = None
    notes: str | None = None
    availability: DeliveryAvailability
    is_active: bool
    current_zone_id: int | None = None
    current_latitude: float | None = None
    current_longitude: float | None = None
    last_location_at: datetime | None = None
    completed_deliveries: int
    rating: float
    push_enabled: bool


class DeliverySettlementPaymentCreate(BaseModel):
    rider_user_id: int
    amount: float = Field(gt=0)
    paid_at: datetime
    reference: str | None = None
    notes: str | None = None


class DeliverySettlementRead(BaseModel):
    rider_user_id: int
    rider_name: str
    vehicle_type: str
    cash_liability_total: float
    cash_liability_open: float
    rider_fee_earned_total: float
    rider_fee_paid_total: float
    pending_amount: float
    merchant_cash_payable_total: float


class NotificationRead(BaseModel):
    id: int
    order_id: int | None = None
    channel: str
    event_type: str
    title: str
    body: str
    payload_json: str | None = None
    is_read: bool
    push_status: str
    created_at: datetime


class PushSubscriptionWrite(BaseModel):
    endpoint: str
    keys: dict[str, str]
    user_agent: str | None = None


class RiderSettlementNotice(BaseModel):
    rider_user_id: int
    transfer_date: date
    amount: float = Field(gt=0)
    reference: str | None = None
    notes: str | None = None
