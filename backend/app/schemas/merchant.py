from __future__ import annotations

from datetime import time
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, model_validator


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
    postal_code: str | None = Field(default=None, min_length=4, max_length=20)
    province: str | None = Field(default=None, min_length=1, max_length=120)
    locality: str | None = Field(default=None, min_length=1, max_length=120)
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
    free_delivery_min_order: float | None = Field(default=None, ge=0)
    rider_fee: float = Field(default=0, ge=0)
    min_order: float = 0


class StorePaymentSettingsUpdate(BaseModel):
    cash_enabled: bool
    mercadopago_enabled: bool


class MerchantRiderCreate(BaseModel):
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


class MerchantRiderUpdate(BaseModel):
    full_name: str
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
    is_active: bool = True


class MerchantRiderSettlementPaymentCreate(BaseModel):
    rider_user_id: int
    amount: float = Field(gt=0)
    paid_at: datetime
    reference: str | None = None
    notes: str | None = None


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


class ProductSubcategoryCreate(BaseModel):
    product_category_id: int
    name: str
    sort_order: int = 0


class ProductSubcategoryUpdate(BaseModel):
    product_category_id: int
    name: str
    sort_order: int = 0


class ProductWrite(BaseModel):
    product_category_id: int | None = None
    product_subcategory_id: int | None = None
    sku: str = Field(min_length=2, max_length=80)
    name: str
    brand: str | None = None
    barcode: str | None = None
    unit_label: str | None = None
    description: str
    price: float = Field(ge=0)
    compare_at_price: float | None = None
    commercial_discount_type: Literal["percentage", "fixed"] | None = None
    commercial_discount_value: float | None = Field(default=None, ge=0)
    image_url: str | None = None
    stock_quantity: int | None = Field(default=None, ge=0)
    max_per_order: int | None = Field(default=None, ge=1)
    is_available: bool = True
    sort_order: int = 0

    @model_validator(mode="after")
    def validate_discount(self) -> "ProductWrite":
        if self.commercial_discount_type is None and self.commercial_discount_value not in (None, 0):
            raise ValueError("commercial_discount_type is required when commercial_discount_value is set")
        if self.commercial_discount_type is not None and self.commercial_discount_value in (None, 0):
            raise ValueError("commercial_discount_value must be greater than zero when commercial_discount_type is set")
        if self.compare_at_price is not None and self.compare_at_price < 0:
            raise ValueError("compare_at_price cannot be negative")
        return self
