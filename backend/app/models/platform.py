from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class PlatformSettings(Base):
    __tablename__ = "platform_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    service_fee_amount: Mapped[float] = mapped_column(Numeric(10, 2), default=350)
    platform_logo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    platform_favicon_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    platform_use_logo_as_favicon: Mapped[bool] = mapped_column(Boolean, default=False)
    catalog_banner_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    catalog_banner_width: Mapped[int] = mapped_column(Integer, default=1600)
    catalog_banner_height: Mapped[int] = mapped_column(Integer, default=520)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class PaymentProvider(Base):
    __tablename__ = "payment_providers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    provider: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    client_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    client_secret_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    redirect_uri: Mapped[str | None] = mapped_column(Text, nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    mode: Mapped[str] = mapped_column(String(20), default="sandbox")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class MerchantServiceFeeCharge(Base):
    __tablename__ = "merchant_service_fee_charges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("store_orders.id", ondelete="CASCADE"), unique=True, index=True
    )
    amount: Mapped[float] = mapped_column(Numeric(10, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    store: Mapped["Store"] = relationship(back_populates="service_fee_charges")
    order: Mapped["StoreOrder"] = relationship(back_populates="service_fee_charge")
    allocations: Mapped[list["MerchantSettlementAllocation"]] = relationship(
        back_populates="charge", cascade="all, delete-orphan"
    )


class MerchantTransferNotice(Base):
    __tablename__ = "merchant_transfer_notices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    amount: Mapped[float] = mapped_column(Numeric(10, 2))
    transfer_date: Mapped[date] = mapped_column(Date)
    bank: Mapped[str] = mapped_column(String(120))
    reference: Mapped[str] = mapped_column(String(180))
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    proof_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    proof_content_type: Mapped[str | None] = mapped_column(String(120), nullable=True)
    proof_original_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(40), default="pending_review", index=True)
    review_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    store: Mapped["Store"] = relationship(back_populates="transfer_notices")
    reviewed_by: Mapped["User | None"] = relationship()
    settlement_payment: Mapped["MerchantSettlementPayment | None"] = relationship(
        back_populates="notice", uselist=False
    )


class MerchantSettlementPayment(Base):
    __tablename__ = "merchant_settlement_payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    notice_id: Mapped[int | None] = mapped_column(
        ForeignKey("merchant_transfer_notices.id", ondelete="SET NULL"),
        nullable=True,
        unique=True,
        index=True,
    )
    source: Mapped[str] = mapped_column(String(40), default="admin_manual")
    amount: Mapped[float] = mapped_column(Numeric(10, 2))
    paid_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    reference: Mapped[str | None] = mapped_column(String(180), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    store: Mapped["Store"] = relationship(back_populates="settlement_payments")
    notice: Mapped["MerchantTransferNotice | None"] = relationship(back_populates="settlement_payment")
    created_by: Mapped["User | None"] = relationship()
    allocations: Mapped[list["MerchantSettlementAllocation"]] = relationship(
        back_populates="payment", cascade="all, delete-orphan"
    )


class MerchantSettlementAllocation(Base):
    __tablename__ = "merchant_settlement_allocations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    payment_id: Mapped[int] = mapped_column(
        ForeignKey("merchant_settlement_payments.id", ondelete="CASCADE"), index=True
    )
    charge_id: Mapped[int] = mapped_column(
        ForeignKey("merchant_service_fee_charges.id", ondelete="CASCADE"), index=True
    )
    amount: Mapped[float] = mapped_column(Numeric(10, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    payment: Mapped[MerchantSettlementPayment] = relationship(back_populates="allocations")
    charge: Mapped[MerchantServiceFeeCharge] = relationship(back_populates="allocations")
