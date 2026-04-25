from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class PaymentTransaction(Base):
    __tablename__ = "payment_transactions"
    __table_args__ = (
        UniqueConstraint("provider", "external_reference", name="uq_payment_transactions_provider_reference"),
        UniqueConstraint("provider", "payment_id", name="uq_payment_transactions_provider_payment_id"),
        UniqueConstraint("provider", "preference_id", name="uq_payment_transactions_provider_preference_id"),
        UniqueConstraint("provider", "idempotency_key", name="uq_payment_transactions_provider_idempotency_key"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("store_orders.id", ondelete="CASCADE"), unique=True, index=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    provider: Mapped[str] = mapped_column(String(60), default="mercadopago", index=True)
    external_reference: Mapped[str] = mapped_column(String(120), index=True)
    preference_id: Mapped[str | None] = mapped_column(String(160), nullable=True, index=True)
    payment_id: Mapped[str | None] = mapped_column(String(160), nullable=True, index=True)
    idempotency_key: Mapped[str | None] = mapped_column(String(160), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(40), default="pending", index=True)
    status_detail: Mapped[str | None] = mapped_column(String(120), nullable=True)
    amount_total: Mapped[float] = mapped_column(Numeric(10, 2))
    currency: Mapped[str] = mapped_column(String(3), default="ARS")
    requested_marketplace_fee: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    approved_marketplace_fee: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    seller_expected_amount: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    delivery_fee_amount: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    service_fee_amount: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    mp_user_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    live_mode: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    checkout_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_payment_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    preference_raw_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    order: Mapped["StoreOrder"] = relationship(back_populates="payment_transaction")
    store: Mapped["Store"] = relationship(back_populates="payment_transactions")


class PaymentWebhookEvent(Base):
    __tablename__ = "payment_webhook_events"
    __table_args__ = (
        UniqueConstraint("provider", "event_id", "request_id", name="uq_payment_webhook_events_provider_event_request"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    provider: Mapped[str] = mapped_column(String(60), default="mercadopago", index=True)
    event_id: Mapped[str] = mapped_column(String(160), index=True)
    request_id: Mapped[str | None] = mapped_column(String(160), nullable=True, index=True)
    payment_id: Mapped[str | None] = mapped_column(String(160), nullable=True, index=True)
    external_reference: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    signature_valid: Mapped[bool] = mapped_column(Boolean, default=False)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    payload_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
