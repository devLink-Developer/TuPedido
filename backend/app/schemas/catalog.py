from __future__ import annotations

from datetime import datetime, time

from pydantic import BaseModel, Field, field_validator

from app.services.category_colors import normalize_hex_color
from app.services.platform import DEFAULT_CATALOG_BANNER_HEIGHT, DEFAULT_CATALOG_BANNER_WIDTH


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1)
    description: str | None = None
    color: str
    color_light: str | None = None
    icon: str | None = Field(default=None, max_length=24)
    is_active: bool = True
    sort_order: int = 0

    @field_validator("color", "color_light", mode="before")
    @classmethod
    def validate_color_fields(cls, value: str | None) -> str | None:
        return normalize_hex_color(value)


class CategoryUpdate(BaseModel):
    name: str = Field(min_length=1)
    description: str | None = None
    color: str
    color_light: str | None = None
    icon: str | None = Field(default=None, max_length=24)
    is_active: bool = True
    sort_order: int = 0

    @field_validator("color", "color_light", mode="before")
    @classmethod
    def validate_color_fields(cls, value: str | None) -> str | None:
        return normalize_hex_color(value)


class CategoryRead(BaseModel):
    id: int
    name: str
    slug: str
    description: str | None = None
    color: str
    color_light: str
    icon: str | None = None
    is_active: bool
    sort_order: int


class CatalogBannerRead(BaseModel):
    catalog_banner_image_url: str | None = None
    catalog_banner_width: int = DEFAULT_CATALOG_BANNER_WIDTH
    catalog_banner_height: int = DEFAULT_CATALOG_BANNER_HEIGHT


class StoreHourRead(BaseModel):
    day_of_week: int
    opens_at: time | None = None
    closes_at: time | None = None
    is_closed: bool


class StoreDeliverySettingsRead(BaseModel):
    delivery_enabled: bool
    pickup_enabled: bool
    delivery_fee: float
    free_delivery_min_order: float | None = None
    rider_fee: float
    min_order: float


class StorePaymentSettingsRead(BaseModel):
    cash_enabled: bool
    mercadopago_enabled: bool
    mercadopago_configured: bool
    mercadopago_provider_enabled: bool = False
    mercadopago_provider_mode: str = "sandbox"
    mercadopago_public_key_masked: str | None = None
    mercadopago_connection_status: str = "disconnected"
    mercadopago_reconnect_required: bool = False
    mercadopago_onboarding_completed: bool = False
    mercadopago_oauth_connected_at: datetime | None = None
    mercadopago_mp_user_id: str | None = None


class ProductSubcategoryRead(BaseModel):
    id: int
    product_category_id: int
    name: str
    slug: str
    sort_order: int


class ProductCategoryRead(BaseModel):
    id: int
    name: str
    slug: str
    sort_order: int
    subcategories: list[ProductSubcategoryRead] = Field(default_factory=list)


class ProductRead(BaseModel):
    id: int
    store_id: int
    product_category_id: int | None = None
    product_category_name: str | None = None
    product_subcategory_id: int | None = None
    product_subcategory_name: str | None = None
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
    postal_code: str | None = None
    province: str | None = None
    locality: str | None = None
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
    primary_category_id: int | None = None
    primary_category: str | None = None
    primary_category_slug: str | None = None
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
