from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.pricing import PricingSummaryRead
from app.schemas.promotion import AppliedPromotionSummaryRead


class CheckoutRequest(BaseModel):
    store_id: int
    address_id: int | None = None
    delivery_mode: Literal["delivery", "pickup"]
    payment_method: Literal["cash", "mercadopago"]


class CheckoutResponse(BaseModel):
    order_id: int
    status: str
    payment_status: str
    payment_reference: str | None = None
    checkout_url: str | None = None


class OrderItemRead(BaseModel):
    id: int
    product_id: int | None = None
    product_name: str
    base_unit_price: float
    quantity: int
    unit_price: float
    commercial_discount_amount: float
    note: str | None = None


class OrderRead(BaseModel):
    id: int
    store_id: int
    store_name: str
    store_slug: str
    customer_name: str
    delivery_mode: str
    payment_method: str
    payment_status: str
    payment_reference: str | None = None
    status: str
    address_label: str | None = None
    address_full: str | None = None
    store_latitude: float | None = None
    store_longitude: float | None = None
    address_latitude: float | None = None
    address_longitude: float | None = None
    subtotal: float
    commercial_discount_total: float
    financial_discount_total: float
    delivery_fee: float
    service_fee: float
    delivery_fee_customer: float
    rider_fee: float
    total: float
    delivery_status: str
    delivery_provider: str
    delivery_zone_id: int | None = None
    assigned_rider_id: int | None = None
    assigned_rider_name: str | None = None
    assigned_rider_phone_masked: str | None = None
    assigned_rider_vehicle_type: str | None = None
    tracking_last_latitude: float | None = None
    tracking_last_longitude: float | None = None
    tracking_last_at: datetime | None = None
    tracking_stale: bool = False
    eta_minutes: int | None = None
    otp_required: bool = False
    merchant_ready_at: datetime | None = None
    out_for_delivery_at: datetime | None = None
    delivered_at: datetime | None = None
    updated_at: datetime | None = None
    created_at: datetime
    items: list[OrderItemRead]
    pricing: PricingSummaryRead
    applied_promotions: list[AppliedPromotionSummaryRead] = []


class OrderTrackingRead(BaseModel):
    order_id: int
    status: str
    delivery_status: str
    delivery_provider: str
    tracking_enabled: bool
    assigned_rider_id: int | None = None
    assigned_rider_name: str | None = None
    assigned_rider_phone_masked: str | None = None
    assigned_rider_vehicle_type: str | None = None
    store_latitude: float | None = None
    store_longitude: float | None = None
    address_latitude: float | None = None
    address_longitude: float | None = None
    tracking_last_latitude: float | None = None
    tracking_last_longitude: float | None = None
    tracking_last_at: datetime | None = None
    tracking_stale: bool = False
    eta_minutes: int | None = None
    otp_required: bool = False
    otp_code: str | None = None


class PendingOrderReviewRead(BaseModel):
    order_id: int
    store_name: str
    delivered_at: datetime | None = None
    rider_name: str | None = None
    requires_rider_rating: bool


class OrderReviewCreate(BaseModel):
    store_rating: int = Field(ge=1, le=5)
    rider_rating: int | None = Field(default=None, ge=1, le=5)
    review_text: str | None = None


class OrderStatusUpdate(BaseModel):
    status: Literal[
        "created",
        "accepted",
        "preparing",
        "ready_for_dispatch",
        "ready_for_pickup",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "delivery_failed",
    ]


class MercadoPagoWebhookPayload(BaseModel):
    reference: str
    status: Literal["pending", "approved", "rejected", "cancelled"]
