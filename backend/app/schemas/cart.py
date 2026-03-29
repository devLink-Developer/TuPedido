from pydantic import BaseModel

from app.schemas.catalog import StoreDeliverySettingsRead
from app.schemas.pricing import PricingSummaryRead


class CartItemCreate(BaseModel):
    store_id: int
    product_id: int
    quantity: int = 1
    note: str | None = None


class CartItemUpdate(BaseModel):
    quantity: int
    note: str | None = None


class CartUpdate(BaseModel):
    delivery_mode: str


class CartItemRead(BaseModel):
    id: int
    product_id: int
    product_name: str
    base_unit_price: float
    unit_price: float
    commercial_discount_amount: float
    quantity: int
    note: str | None = None

    model_config = {"from_attributes": True}


class CartRead(BaseModel):
    id: int
    store_id: int | None = None
    store_name: str | None = None
    store_slug: str | None = None
    delivery_mode: str
    delivery_settings: StoreDeliverySettingsRead
    subtotal: float
    delivery_fee: float
    service_fee: float
    total: float
    commercial_discount_total: float
    financial_discount_total: float
    pricing: PricingSummaryRead
    items: list[CartItemRead]
