from __future__ import annotations

from datetime import time
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class MerchantApplicationCreate(BaseModel):
    business_name: str
    description: str
    address: str
    phone: str
    logo_url: str | None = None
    cover_image_url: str | None = None
    requested_category_ids: list[int] = Field(min_length=1)


class MerchantApplicationRegister(BaseModel):
    full_name: str
    email: EmailStr
    password: str = Field(min_length=6)
    business_name: str
    description: str
    address: str
    phone: str
    requested_category_ids: list[int] = Field(min_length=1)


class MerchantApplicationReviewUpdate(BaseModel):
    status: Literal["approved", "rejected", "suspended"]
    review_notes: str | None = None


class StoreUpdate(BaseModel):
    name: str
    description: str
    address: str
    phone: str
    latitude: float | None = None
    longitude: float | None = None
    logo_url: str | None = None
    cover_image_url: str | None = None
    accepting_orders: bool = True
    opening_note: str | None = None
    min_delivery_minutes: int = 20
    max_delivery_minutes: int = 45


class StoreCategoriesUpdate(BaseModel):
    category_ids: list[int]


class StoreHourWrite(BaseModel):
    day_of_week: int
    opens_at: time | None = None
    closes_at: time | None = None
    is_closed: bool = False


class StoreHoursUpdate(BaseModel):
    hours: list[StoreHourWrite]


class StoreDeliverySettingsUpdate(BaseModel):
    delivery_enabled: bool
    pickup_enabled: bool
    delivery_fee: float
    min_order: float = 0


class StorePaymentSettingsUpdate(BaseModel):
    cash_enabled: bool
    mercadopago_enabled: bool


class MercadoPagoCredentialsUpdate(BaseModel):
    public_key: str
    access_token: str


class MercadoPagoConnectUrlRead(BaseModel):
    connect_url: str
    connection_status: str
    status: str | None = None
    callback_url: str | None = None


class ProductCategoryCreate(BaseModel):
    name: str
    sort_order: int = 0


class ProductCategoryUpdate(BaseModel):
    name: str
    sort_order: int = 0


class ProductWrite(BaseModel):
    product_category_id: int | None = None
    name: str
    description: str
    price: float
    compare_at_price: float | None = None
    image_url: str | None = None
    is_available: bool = True
    sort_order: int = 0
