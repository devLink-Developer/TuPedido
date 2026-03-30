from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ShoppingCart(Base):
    __tablename__ = "shopping_carts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True
    )
    store_id: Mapped[int | None] = mapped_column(
        ForeignKey("stores.id", ondelete="SET NULL"), nullable=True, index=True
    )
    delivery_mode: Mapped[str] = mapped_column(String(40), default="delivery")
    subtotal: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    commercial_discount_total: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    financial_discount_total: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    delivery_fee: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    service_fee: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    total: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="cart")
    store: Mapped["Store | None"] = relationship(back_populates="carts")
    items: Mapped[list["ShoppingCartItem"]] = relationship(
        back_populates="cart", cascade="all, delete-orphan"
    )


class ShoppingCartItem(Base):
    __tablename__ = "shopping_cart_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    cart_id: Mapped[int] = mapped_column(
        ForeignKey("shopping_carts.id", ondelete="CASCADE"), index=True
    )
    product_id: Mapped[int] = mapped_column(
        ForeignKey("store_products.id", ondelete="CASCADE"), index=True
    )
    product_name_snapshot: Mapped[str] = mapped_column(String(180))
    base_unit_price_snapshot: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    unit_price_snapshot: Mapped[float] = mapped_column(Numeric(10, 2))
    commercial_discount_amount_snapshot: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    quantity: Mapped[int] = mapped_column(Integer)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    cart: Mapped[ShoppingCart] = relationship(back_populates="items")
    product: Mapped["Product"] = relationship(back_populates="cart_items")


class StoreOrder(Base):
    __tablename__ = "store_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="SET NULL"), index=True)
    address_id: Mapped[int | None] = mapped_column(
        ForeignKey("addresses.id", ondelete="SET NULL"), nullable=True, index=True
    )
    delivery_mode: Mapped[str] = mapped_column(String(40))
    payment_method: Mapped[str] = mapped_column(String(40))
    payment_status: Mapped[str] = mapped_column(String(40), default="pending")
    payment_reference: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    customer_name_snapshot: Mapped[str] = mapped_column(String(180))
    store_name_snapshot: Mapped[str] = mapped_column(String(180))
    store_slug_snapshot: Mapped[str] = mapped_column(String(180))
    store_address_snapshot: Mapped[str] = mapped_column(Text)
    address_label_snapshot: Mapped[str | None] = mapped_column(String(80), nullable=True)
    address_full_snapshot: Mapped[str | None] = mapped_column(Text, nullable=True)
    subtotal: Mapped[float] = mapped_column(Numeric(10, 2))
    commercial_discount_total: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    financial_discount_total: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    delivery_fee: Mapped[float] = mapped_column(Numeric(10, 2))
    service_fee: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    delivery_fee_customer: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    rider_fee: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    total: Mapped[float] = mapped_column(Numeric(10, 2))
    status: Mapped[str] = mapped_column(String(40), default="created", index=True)
    delivery_status: Mapped[str] = mapped_column(String(40), default="unassigned", index=True)
    delivery_provider: Mapped[str] = mapped_column(String(40), default="store")
    delivery_zone_id: Mapped[int | None] = mapped_column(
        ForeignKey("delivery_zones.id", ondelete="SET NULL"), nullable=True, index=True
    )
    assigned_rider_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    assigned_rider_name_snapshot: Mapped[str | None] = mapped_column(String(180), nullable=True)
    assigned_rider_phone_masked: Mapped[str | None] = mapped_column(String(60), nullable=True)
    assigned_rider_vehicle_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    tracking_last_latitude: Mapped[float | None] = mapped_column(Numeric(10, 7), nullable=True)
    tracking_last_longitude: Mapped[float | None] = mapped_column(Numeric(10, 7), nullable=True)
    tracking_last_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    tracking_stale: Mapped[bool] = mapped_column(default=False)
    eta_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    otp_code: Mapped[str | None] = mapped_column(String(12), nullable=True)
    otp_required: Mapped[bool] = mapped_column(default=False)
    otp_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    merchant_ready_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    out_for_delivery_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    review_prompt_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="orders", foreign_keys=[user_id])
    store: Mapped["Store"] = relationship(back_populates="orders")
    address: Mapped["Address | None"] = relationship()
    items: Mapped[list["StoreOrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan"
    )
    delivery_zone: Mapped["DeliveryZone | None"] = relationship(back_populates="orders")
    assigned_rider: Mapped["User | None"] = relationship(foreign_keys=[assigned_rider_id])
    delivery_assignment: Mapped["DeliveryAssignment | None"] = relationship(
        back_populates="order", uselist=False
    )
    notifications: Mapped[list["NotificationEvent"]] = relationship(
        back_populates="order", cascade="all, delete-orphan"
    )
    service_fee_charge: Mapped["MerchantServiceFeeCharge | None"] = relationship(
        back_populates="order", uselist=False
    )
    rider_settlement_charge: Mapped["RiderSettlementCharge | None"] = relationship(
        back_populates="order", uselist=False
    )
    merchant_cash_delivery_payable: Mapped["MerchantCashDeliveryPayable | None"] = relationship(
        back_populates="order", uselist=False
    )
    order_review: Mapped["OrderReview | None"] = relationship(
        back_populates="order", uselist=False, cascade="all, delete-orphan"
    )


class StoreOrderItem(Base):
    __tablename__ = "store_order_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("store_orders.id", ondelete="CASCADE"), index=True
    )
    product_id: Mapped[int | None] = mapped_column(
        ForeignKey("store_products.id", ondelete="SET NULL"), nullable=True, index=True
    )
    product_name_snapshot: Mapped[str] = mapped_column(String(180))
    base_unit_price_snapshot: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    unit_price_snapshot: Mapped[float] = mapped_column(Numeric(10, 2))
    commercial_discount_amount_snapshot: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    quantity: Mapped[int] = mapped_column(Integer)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    order: Mapped[StoreOrder] = relationship(back_populates="items")
    product: Mapped["Product | None"] = relationship(back_populates="order_items")


class OrderReview(Base):
    __tablename__ = "order_reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("store_orders.id", ondelete="CASCADE"), unique=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    rider_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    store_rating: Mapped[int] = mapped_column(Integer)
    rider_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    review_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    order: Mapped[StoreOrder] = relationship(back_populates="order_review")
