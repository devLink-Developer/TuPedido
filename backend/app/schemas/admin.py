from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class StoreStatusUpdate(BaseModel):
    status: Literal["approved", "rejected", "suspended"]


class AdminMerchantCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str = Field(min_length=6)
    business_name: str
    description: str
    address: str
    phone: str
    logo_url: str | None = None
    cover_image_url: str | None = None
    category_ids: list[int] = Field(min_length=1)
    review_notes: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    accepting_orders: bool = True
    opening_note: str | None = None
    min_delivery_minutes: int = Field(default=20, ge=0)
    max_delivery_minutes: int = Field(default=45, ge=0)
    delivery_enabled: bool = True
    pickup_enabled: bool = True
    delivery_fee: float = Field(default=0, ge=0)
    min_order: float = Field(default=0, ge=0)
    cash_enabled: bool = True
    mercadopago_enabled: bool = False


class AdminRiderCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str = Field(min_length=6)
    phone: str
    vehicle_type: Literal["bicycle", "motorcycle", "car"]
    dni_number: str
    emergency_contact_name: str
    emergency_contact_phone: str
    photo_url: str | None = None
    license_number: str | None = None
    vehicle_plate: str | None = None
    insurance_policy: str | None = None
    notes: str | None = None
    review_notes: str | None = None
    current_zone_id: int | None = None
    availability: Literal["offline", "idle", "reserved", "delivering", "paused"] = "offline"
    is_active: bool = True
