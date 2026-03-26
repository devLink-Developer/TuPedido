from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(180))
    email: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(40), default="customer", index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    addresses: Mapped[list["Address"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    applications: Mapped[list["MerchantApplication"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    delivery_applications: Mapped[list["DeliveryApplication"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="DeliveryApplication.user_id",
    )
    owned_store: Mapped["Store | None"] = relationship(back_populates="owner", uselist=False)
    cart: Mapped["ShoppingCart | None"] = relationship(back_populates="user", uselist=False)
    orders: Mapped[list["StoreOrder"]] = relationship(
        back_populates="user",
        foreign_keys="StoreOrder.user_id",
    )
    delivery_profile: Mapped["DeliveryProfile | None"] = relationship(
        back_populates="user",
        uselist=False,
        foreign_keys="DeliveryProfile.user_id",
    )
    delivery_assignments: Mapped[list["DeliveryAssignment"]] = relationship(
        back_populates="rider",
        foreign_keys="DeliveryAssignment.rider_user_id",
    )
    notifications: Mapped[list["NotificationEvent"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    push_subscriptions: Mapped[list["PushSubscription"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Address(Base):
    __tablename__ = "addresses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    label: Mapped[str] = mapped_column(String(80))
    postal_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    province: Mapped[str | None] = mapped_column(String(120), nullable=True)
    locality: Mapped[str | None] = mapped_column(String(120), nullable=True)
    street: Mapped[str] = mapped_column(String(255))
    details: Mapped[str] = mapped_column(Text)
    latitude: Mapped[float | None] = mapped_column(Numeric(10, 7), nullable=True)
    longitude: Mapped[float | None] = mapped_column(Numeric(10, 7), nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped[User] = relationship(back_populates="addresses")


class MerchantApplication(Base):
    __tablename__ = "merchant_applications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    business_name: Mapped[str] = mapped_column(String(180))
    description: Mapped[str] = mapped_column(Text)
    address: Mapped[str] = mapped_column(Text)
    phone: Mapped[str] = mapped_column(String(60))
    logo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    cover_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    requested_category_ids: Mapped[list[int]] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(40), default="pending_review", index=True)
    review_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped[User] = relationship(back_populates="applications")
    store: Mapped["Store | None"] = relationship(back_populates="application", uselist=False)
