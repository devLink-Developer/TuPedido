from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, foreign, mapped_column, relationship

from app.db.base import Base


class DeliveryApplication(Base):
    __tablename__ = "delivery_applications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    phone: Mapped[str] = mapped_column(String(60))
    vehicle_type: Mapped[str] = mapped_column(String(40), index=True)
    photo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    dni_number: Mapped[str] = mapped_column(String(60))
    emergency_contact_name: Mapped[str] = mapped_column(String(180))
    emergency_contact_phone: Mapped[str] = mapped_column(String(60))
    license_number: Mapped[str | None] = mapped_column(String(120), nullable=True)
    vehicle_plate: Mapped[str | None] = mapped_column(String(60), nullable=True)
    insurance_policy: Mapped[str | None] = mapped_column(String(180), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(40), default="pending_review", index=True)
    review_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="delivery_applications", foreign_keys=[user_id])
    reviewed_by: Mapped["User | None"] = relationship(foreign_keys=[reviewed_by_user_id])
    profile: Mapped["DeliveryProfile | None"] = relationship(back_populates="application", uselist=False)


class DeliveryProfile(Base):
    __tablename__ = "delivery_profiles"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    application_id: Mapped[int | None] = mapped_column(
        ForeignKey("delivery_applications.id", ondelete="SET NULL"),
        unique=True,
        nullable=True,
        index=True,
    )
    phone: Mapped[str] = mapped_column(String(60))
    vehicle_type: Mapped[str] = mapped_column(String(40), index=True)
    photo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    dni_number: Mapped[str] = mapped_column(String(60))
    emergency_contact_name: Mapped[str] = mapped_column(String(180))
    emergency_contact_phone: Mapped[str] = mapped_column(String(60))
    license_number: Mapped[str | None] = mapped_column(String(120), nullable=True)
    vehicle_plate: Mapped[str | None] = mapped_column(String(60), nullable=True)
    insurance_policy: Mapped[str | None] = mapped_column(String(180), nullable=True)
    availability: Mapped[str] = mapped_column(String(40), default="offline", index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    current_zone_id: Mapped[int | None] = mapped_column(
        ForeignKey("delivery_zones.id", ondelete="SET NULL"), nullable=True, index=True
    )
    current_latitude: Mapped[float | None] = mapped_column(Numeric(10, 7), nullable=True)
    current_longitude: Mapped[float | None] = mapped_column(Numeric(10, 7), nullable=True)
    last_location_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    push_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    approved_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_deliveries: Mapped[int] = mapped_column(Integer, default=0)
    rating: Mapped[float] = mapped_column(Numeric(4, 2), default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="delivery_profile", foreign_keys=[user_id])
    application: Mapped["DeliveryApplication | None"] = relationship(back_populates="profile")
    approved_by: Mapped["User | None"] = relationship(foreign_keys=[approved_by_user_id])
    zone: Mapped["DeliveryZone | None"] = relationship(back_populates="riders")
    assignments: Mapped[list["DeliveryAssignment"]] = relationship(
        primaryjoin="DeliveryProfile.user_id == foreign(DeliveryAssignment.rider_user_id)",
        viewonly=True,
    )
    settlement_charges: Mapped[list["RiderSettlementCharge"]] = relationship(
        primaryjoin="DeliveryProfile.user_id == foreign(RiderSettlementCharge.rider_user_id)",
        viewonly=True,
    )
    settlement_payments: Mapped[list["RiderSettlementPayment"]] = relationship(
        primaryjoin="DeliveryProfile.user_id == foreign(RiderSettlementPayment.rider_user_id)",
        viewonly=True,
    )


class DeliveryZone(Base):
    __tablename__ = "delivery_zones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(160), unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    center_latitude: Mapped[float] = mapped_column(Numeric(10, 7))
    center_longitude: Mapped[float] = mapped_column(Numeric(10, 7))
    radius_km: Mapped[float] = mapped_column(Numeric(10, 2), default=5)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    rates: Mapped[list["DeliveryZoneRate"]] = relationship(
        back_populates="zone", cascade="all, delete-orphan"
    )
    riders: Mapped[list["DeliveryProfile"]] = relationship(back_populates="zone")
    orders: Mapped[list["StoreOrder"]] = relationship(back_populates="delivery_zone")
    assignments: Mapped[list["DeliveryAssignment"]] = relationship(back_populates="zone")


class DeliveryZoneRate(Base):
    __tablename__ = "delivery_zone_rates"
    __table_args__ = (UniqueConstraint("zone_id", "vehicle_type", name="uq_delivery_zone_rates_zone_vehicle"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    zone_id: Mapped[int] = mapped_column(ForeignKey("delivery_zones.id", ondelete="CASCADE"), index=True)
    vehicle_type: Mapped[str] = mapped_column(String(40), index=True)
    delivery_fee_customer: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    rider_fee: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    zone: Mapped["DeliveryZone"] = relationship(back_populates="rates")


class DeliveryAssignment(Base):
    __tablename__ = "delivery_assignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("store_orders.id", ondelete="CASCADE"), unique=True, index=True
    )
    rider_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    zone_id: Mapped[int | None] = mapped_column(
        ForeignKey("delivery_zones.id", ondelete="SET NULL"), nullable=True, index=True
    )
    status: Mapped[str] = mapped_column(String(40), default="unassigned", index=True)
    vehicle_type_snapshot: Mapped[str | None] = mapped_column(String(40), nullable=True)
    offer_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    picked_up_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    near_customer_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    current_latitude: Mapped[float | None] = mapped_column(Numeric(10, 7), nullable=True)
    current_longitude: Mapped[float | None] = mapped_column(Numeric(10, 7), nullable=True)
    current_heading: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    current_speed_kmh: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    last_eta_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    distance_km: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    last_heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    tracking_stale: Mapped[bool] = mapped_column(Boolean, default=False)
    otp_code: Mapped[str | None] = mapped_column(String(12), nullable=True)
    otp_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    order: Mapped["StoreOrder"] = relationship(back_populates="delivery_assignment")
    rider: Mapped["User | None"] = relationship(back_populates="delivery_assignments")
    zone: Mapped["DeliveryZone | None"] = relationship(back_populates="assignments")
    location_points: Mapped[list["DeliveryLocationPoint"]] = relationship(
        back_populates="assignment", cascade="all, delete-orphan"
    )


class DeliveryLocationPoint(Base):
    __tablename__ = "delivery_location_points"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    assignment_id: Mapped[int] = mapped_column(
        ForeignKey("delivery_assignments.id", ondelete="CASCADE"), index=True
    )
    latitude: Mapped[float] = mapped_column(Numeric(10, 7))
    longitude: Mapped[float] = mapped_column(Numeric(10, 7))
    heading: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    speed_kmh: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    accuracy_meters: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    assignment: Mapped["DeliveryAssignment"] = relationship(back_populates="location_points")


class NotificationEvent(Base):
    __tablename__ = "notification_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    order_id: Mapped[int | None] = mapped_column(
        ForeignKey("store_orders.id", ondelete="CASCADE"), nullable=True, index=True
    )
    channel: Mapped[str] = mapped_column(String(40), default="in_app", index=True)
    event_type: Mapped[str] = mapped_column(String(80), index=True)
    title: Mapped[str] = mapped_column(String(180))
    body: Mapped[str] = mapped_column(Text)
    payload_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    push_status: Mapped[str] = mapped_column(String(40), default="pending", index=True)
    push_attempted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    user: Mapped["User"] = relationship(back_populates="notifications")
    order: Mapped["StoreOrder | None"] = relationship(back_populates="notifications")


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    endpoint: Mapped[str] = mapped_column(Text, unique=True)
    p256dh: Mapped[str] = mapped_column(Text)
    auth: Mapped[str] = mapped_column(Text)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="push_subscriptions")


class RiderSettlementCharge(Base):
    __tablename__ = "rider_settlement_charges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    rider_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("store_orders.id", ondelete="CASCADE"), unique=True, index=True
    )
    entry_type: Mapped[str] = mapped_column(String(40), index=True)
    amount: Mapped[float] = mapped_column(Numeric(10, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    rider: Mapped["User"] = relationship(foreign_keys=[rider_user_id])
    order: Mapped["StoreOrder"] = relationship(back_populates="rider_settlement_charge")
    allocations: Mapped[list["RiderSettlementAllocation"]] = relationship(
        back_populates="charge", cascade="all, delete-orphan"
    )


class RiderSettlementPayment(Base):
    __tablename__ = "rider_settlement_payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    rider_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    source: Mapped[str] = mapped_column(String(40), default="admin_manual")
    amount: Mapped[float] = mapped_column(Numeric(10, 2))
    paid_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    reference: Mapped[str | None] = mapped_column(String(180), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    rider: Mapped["User"] = relationship(foreign_keys=[rider_user_id])
    created_by: Mapped["User | None"] = relationship(foreign_keys=[created_by_user_id])
    allocations: Mapped[list["RiderSettlementAllocation"]] = relationship(
        back_populates="payment", cascade="all, delete-orphan"
    )


class RiderSettlementAllocation(Base):
    __tablename__ = "rider_settlement_allocations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    payment_id: Mapped[int] = mapped_column(
        ForeignKey("rider_settlement_payments.id", ondelete="CASCADE"), index=True
    )
    charge_id: Mapped[int] = mapped_column(
        ForeignKey("rider_settlement_charges.id", ondelete="CASCADE"), index=True
    )
    amount: Mapped[float] = mapped_column(Numeric(10, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    payment: Mapped["RiderSettlementPayment"] = relationship(back_populates="allocations")
    charge: Mapped["RiderSettlementCharge"] = relationship(back_populates="allocations")


class MerchantCashDeliveryPayable(Base):
    __tablename__ = "merchant_cash_delivery_payables"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("store_orders.id", ondelete="CASCADE"), unique=True, index=True
    )
    amount: Mapped[float] = mapped_column(Numeric(10, 2))
    status: Mapped[str] = mapped_column(String(40), default="pending", index=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    store: Mapped["Store"] = relationship(back_populates="cash_delivery_payables")
    order: Mapped["StoreOrder"] = relationship(back_populates="merchant_cash_delivery_payable")
