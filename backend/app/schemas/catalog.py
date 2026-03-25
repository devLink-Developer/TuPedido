from __future__ import annotations

from datetime import datetime, time

from pydantic import BaseModel, Field


class CategoryCreate(BaseModel):
    name: str
    description: str | None = None


class CategoryRead(BaseModel):
    id: int
    name: str
    slug: str
    description: str | None = None


class StoreHourRead(BaseModel):
    day_of_week: int
    opens_at: time | None = None
    closes_at: time | None = None
    is_closed: bool


class StoreDeliverySettingsRead(BaseModel):
    delivery_enabled: bool
    pickup_enabled: bool
    delivery_fee: float
    min_order: float


class StorePaymentSettingsRead(BaseModel):
    cash_enabled: bool
    mercadopago_enabled: bool
    mercadopago_configured: bool
    mercadopago_public_key_masked: str | None = None
    mercadopago_connection_status: str = "disconnected"
    mercadopago_reconnect_required: bool = False
    mercadopago_oauth_connected_at: datetime | None = None
    mercadopago_collector_id: str | None = None


class ProductCategoryRead(BaseModel):
    id: int
    name: str
    slug: str
    sort_order: int


class ProductRead(BaseModel):
    id: int
    store_id: int
    product_category_id: int | None = None
    product_category_name: str | None = None
    sku: str
    name: str
    brand: str | None = None
    barcode: str | None = None
    unit_label: str | None = None
    description: str
    price: float
    compare_at_price: float | None = None
    final_price: float
    commercial_discount_type: str | None = None
    commercial_discount_value: float | None = None
    commercial_discount_amount: float
    commercial_discount_percentage: float
    has_commercial_discount: bool
    image_url: str | None = None
    stock_quantity: int | None = None
    max_per_order: int | None = None
    is_available: bool
    sort_order: int


class StoreSummaryRead(BaseModel):
    id: int
    slug: str
    name: str
    description: str
    address: str
    phone: str
    latitude: float | None = None
    longitude: float | None = None
    logo_url: str | None = None
    cover_image_url: str | None = None
    status: str
    accepting_orders: bool
    is_open: bool
    opening_note: str | None = None
    min_delivery_minutes: int
    max_delivery_minutes: int
    rating: float
    rating_count: int
    category_ids: list[int] = Field(default_factory=list)
    primary_category: str | None = None
    categories: list[str]
    delivery_settings: StoreDeliverySettingsRead
    payment_settings: StorePaymentSettingsRead


class StoreDetailRead(StoreSummaryRead):
    product_categories: list[ProductCategoryRead]
    products: list[ProductRead]
    hours: list[StoreHourRead]


class MerchantApplicationRead(BaseModel):
    id: int
    business_name: str
    description: str
    address: str
    phone: str
    logo_url: str | None = None
    cover_image_url: str | None = None
    requested_category_ids: list[int]
    requested_category_names: list[str]
    status: str
    review_notes: str | None = None
    created_at: datetime
    updated_at: datetime
    linked_store_slug: str | None = None
