from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.services.platform import DEFAULT_CATALOG_BANNER_HEIGHT, DEFAULT_CATALOG_BANNER_WIDTH


class PlatformSettingsRead(BaseModel):
    service_fee_amount: float
    catalog_banner_image_url: str | None = None
    catalog_banner_width: int = DEFAULT_CATALOG_BANNER_WIDTH
    catalog_banner_height: int = DEFAULT_CATALOG_BANNER_HEIGHT
    updated_at: datetime | None = None
    updated_by: str | None = None


class PlatformSettingsUpdate(BaseModel):
    service_fee_amount: float
    catalog_banner_image_url: str | None = None
    catalog_banner_width: int | None = Field(default=None, ge=1)
    catalog_banner_height: int | None = Field(default=None, ge=1)


class SettlementAllocationRead(BaseModel):
    charge_id: int
    order_id: int
    amount: float


class MerchantSettlementPaymentRead(BaseModel):
    id: int
    store_id: int
    store_name: str | None = None
    store_slug: str | None = None
    notice_id: int | None = None
    source: str
    method: str | None = None
    amount: float
    applied_amount: float
    paid_at: datetime
    reference: str | None = None
    notes: str | None = None
    created_at: datetime
    allocations: list[SettlementAllocationRead]


class MerchantServiceFeeChargeRead(BaseModel):
    id: int
    store_id: int
    order_id: int
    order_status: str
    payment_method: str
    delivery_mode: str
    customer_name: str
    order_total: float
    amount: float
    service_fee: float
    allocated_amount: float
    outstanding_amount: float
    status: str
    created_at: datetime
    order_created_at: datetime
    settled_at: datetime | None = None


class MerchantTransferNoticeRead(BaseModel):
    id: int
    store_id: int
    store_name: str | None = None
    store_slug: str | None = None
    amount: float
    transfer_date: date
    bank: str
    reference: str
    notes: str | None = None
    status: str
    review_notes: str | None = None
    reviewed_notes: str | None = None
    created_at: datetime
    reviewed_at: datetime | None = None
    settlement_payment_id: int | None = None


class MerchantTransferNoticeCreate(BaseModel):
    amount: float
    transfer_date: date
    bank: str
    reference: str
    notes: str | None = None


class MerchantTransferNoticeReviewUpdate(BaseModel):
    status: Literal["approved", "rejected", "pending"]
    review_notes: str | None = None


class MerchantSettlementOverviewRead(BaseModel):
    store_id: int
    store_name: str
    store_slug: str
    service_fee_amount: float
    pending_balance: float
    open_charges_count: int
    pending_charges_count: int
    pending_notices_count: int
    charged_total: float
    paid_total: float
    paid_balance: float
    last_charge_at: datetime | None = None
    last_payment_at: datetime | None = None
    payments: list[MerchantSettlementPaymentRead]


class AdminSettlementStoreRead(BaseModel):
    id: int
    store_id: int
    store_name: str
    store_slug: str
    owner_name: str
    pending_balance: float
    open_charges_count: int
    pending_charges_count: int
    pending_notices_count: int
    charged_total: float
    paid_total: float
    last_charge_at: datetime | None = None
    last_activity_at: datetime | None = None
    status: str | None = None


class AdminSettlementPaymentCreate(BaseModel):
    store_id: int
    amount: float
    paid_at: datetime | None = None
    reference: str | None = None
    notes: str | None = None
