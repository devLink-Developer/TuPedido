from __future__ import annotations

from datetime import datetime, time

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.services.category_colors import DEFAULT_CATEGORY_COLOR


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    color: Mapped[str] = mapped_column(String(7), default=DEFAULT_CATEGORY_COLOR)
    color_light: Mapped[str | None] = mapped_column(String(7), nullable=True)
    icon: Mapped[str | None] = mapped_column(String(24), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    store_links: Mapped[list["StoreCategoryLink"]] = relationship(back_populates="category")


class Store(Base):
    __tablename__ = "stores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    owner_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True
    )
    application_id: Mapped[int | None] = mapped_column(
        ForeignKey("merchant_applications.id", ondelete="SET NULL"),
        unique=True,
        nullable=True,
    )
    slug: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(180))
    description: Mapped[str] = mapped_column(Text)
    address: Mapped[str] = mapped_column(Text)
    phone: Mapped[str] = mapped_column(String(60))
    logo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    cover_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    latitude: Mapped[float | None] = mapped_column(Numeric(10, 7), nullable=True)
    longitude: Mapped[float | None] = mapped_column(Numeric(10, 7), nullable=True)
    status: Mapped[str] = mapped_column(String(40), default="approved", index=True)
    accepting_orders: Mapped[bool] = mapped_column(Boolean, default=True)
    opening_note: Mapped[str | None] = mapped_column(String(160), nullable=True)
    min_delivery_minutes: Mapped[int] = mapped_column(Integer, default=20)
    max_delivery_minutes: Mapped[int] = mapped_column(Integer, default=45)
    rating: Mapped[float] = mapped_column(Float, default=0)
    rating_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    owner: Mapped["User"] = relationship(back_populates="owned_store")
    application: Mapped["MerchantApplication | None"] = relationship(back_populates="store")
    category_links: Mapped[list["StoreCategoryLink"]] = relationship(
        back_populates="store", cascade="all, delete-orphan"
    )
    hours: Mapped[list["StoreHour"]] = relationship(
        back_populates="store", cascade="all, delete-orphan", order_by="StoreHour.day_of_week"
    )
    delivery_settings: Mapped["StoreDeliverySettings | None"] = relationship(
        back_populates="store", uselist=False, cascade="all, delete-orphan"
    )
    payment_settings: Mapped["StorePaymentSettings | None"] = relationship(
        back_populates="store", uselist=False, cascade="all, delete-orphan"
    )
    mercadopago_credentials: Mapped["MercadoPagoCredential | None"] = relationship(
        back_populates="store", uselist=False, cascade="all, delete-orphan"
    )
    product_categories: Mapped[list["ProductCategory"]] = relationship(
        back_populates="store", cascade="all, delete-orphan", order_by="ProductCategory.sort_order"
    )
    products: Mapped[list["Product"]] = relationship(
        back_populates="store", cascade="all, delete-orphan", order_by="Product.sort_order"
    )
    carts: Mapped[list["ShoppingCart"]] = relationship(back_populates="store")
    orders: Mapped[list["StoreOrder"]] = relationship(back_populates="store")
    service_fee_charges: Mapped[list["MerchantServiceFeeCharge"]] = relationship(
        back_populates="store", cascade="all, delete-orphan"
    )
    transfer_notices: Mapped[list["MerchantTransferNotice"]] = relationship(
        back_populates="store", cascade="all, delete-orphan"
    )
    settlement_payments: Mapped[list["MerchantSettlementPayment"]] = relationship(
        back_populates="store", cascade="all, delete-orphan"
    )
    cash_delivery_payables: Mapped[list["MerchantCashDeliveryPayable"]] = relationship(
        back_populates="store", cascade="all, delete-orphan"
    )


class StoreCategoryLink(Base):
    __tablename__ = "store_category_links"

    store_id: Mapped[int] = mapped_column(
        ForeignKey("stores.id", ondelete="CASCADE"), primary_key=True
    )
    category_id: Mapped[int] = mapped_column(
        ForeignKey("categories.id", ondelete="CASCADE"), primary_key=True
    )
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)

    store: Mapped[Store] = relationship(back_populates="category_links")
    category: Mapped[Category] = relationship(back_populates="store_links")


class StoreHour(Base):
    __tablename__ = "store_hours"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    day_of_week: Mapped[int] = mapped_column(Integer, index=True)
    opens_at: Mapped[time | None] = mapped_column(nullable=True)
    closes_at: Mapped[time | None] = mapped_column(nullable=True)
    is_closed: Mapped[bool] = mapped_column(Boolean, default=False)

    store: Mapped[Store] = relationship(back_populates="hours")


class StoreDeliverySettings(Base):
    __tablename__ = "store_delivery_settings"

    store_id: Mapped[int] = mapped_column(
        ForeignKey("stores.id", ondelete="CASCADE"), primary_key=True
    )
    delivery_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    pickup_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    delivery_fee: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    min_order: Mapped[float] = mapped_column(Numeric(10, 2), default=0)

    store: Mapped[Store] = relationship(back_populates="delivery_settings")


class StorePaymentSettings(Base):
    __tablename__ = "store_payment_settings"

    store_id: Mapped[int] = mapped_column(
        ForeignKey("stores.id", ondelete="CASCADE"), primary_key=True
    )
    cash_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    mercadopago_enabled: Mapped[bool] = mapped_column(Boolean, default=False)

    store: Mapped[Store] = relationship(back_populates="payment_settings")


class MercadoPagoCredential(Base):
    __tablename__ = "mercadopago_credentials"

    store_id: Mapped[int] = mapped_column(
        ForeignKey("stores.id", ondelete="CASCADE"), primary_key=True
    )
    public_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    access_token_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    refresh_token_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    collector_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    scope: Mapped[str | None] = mapped_column(String(180), nullable=True)
    live_mode: Mapped[bool] = mapped_column(Boolean, default=False)
    token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    oauth_connected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reconnect_required: Mapped[bool] = mapped_column(Boolean, default=False)
    is_configured: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    store: Mapped[Store] = relationship(back_populates="mercadopago_credentials")


class ProductCategory(Base):
    __tablename__ = "product_categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    slug: Mapped[str] = mapped_column(String(120), index=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    store: Mapped[Store] = relationship(back_populates="product_categories")
    subcategories: Mapped[list["ProductSubcategory"]] = relationship(
        back_populates="product_category", cascade="all, delete-orphan", order_by="ProductSubcategory.sort_order"
    )
    products: Mapped[list["Product"]] = relationship(back_populates="product_category")


class ProductSubcategory(Base):
    __tablename__ = "product_subcategories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    product_category_id: Mapped[int] = mapped_column(
        ForeignKey("product_categories.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(120))
    slug: Mapped[str] = mapped_column(String(120), index=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    product_category: Mapped[ProductCategory] = relationship(back_populates="subcategories")
    products: Mapped[list["Product"]] = relationship(back_populates="product_subcategory")


class Product(Base):
    __tablename__ = "store_products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    product_category_id: Mapped[int | None] = mapped_column(
        ForeignKey("product_categories.id", ondelete="SET NULL"), index=True, nullable=True
    )
    product_subcategory_id: Mapped[int | None] = mapped_column(
        ForeignKey("product_subcategories.id", ondelete="SET NULL"), index=True, nullable=True
    )
    sku: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(180))
    brand: Mapped[str | None] = mapped_column(String(120), nullable=True)
    barcode: Mapped[str | None] = mapped_column(String(80), nullable=True)
    unit_label: Mapped[str | None] = mapped_column(String(60), nullable=True)
    description: Mapped[str] = mapped_column(Text)
    price: Mapped[float] = mapped_column(Numeric(10, 2))
    compare_at_price: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    commercial_discount_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    commercial_discount_value: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    stock_quantity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_per_order: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    store: Mapped[Store] = relationship(back_populates="products")
    product_category: Mapped["ProductCategory | None"] = relationship(back_populates="products")
    product_subcategory: Mapped["ProductSubcategory | None"] = relationship(back_populates="products")
    cart_items: Mapped[list["ShoppingCartItem"]] = relationship(back_populates="product")
    order_items: Mapped[list["StoreOrderItem"]] = relationship(back_populates="product")
