from sqlalchemy import Float, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Restaurant(Base):
    __tablename__ = "restaurants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(180), index=True)
    cuisine: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text)
    eta_minutes: Mapped[str] = mapped_column(String(40))
    rating: Mapped[float] = mapped_column(Float, default=0)
    delivery_fee: Mapped[str] = mapped_column(String(40), default="Gratis")
    cover_image: Mapped[str] = mapped_column(Text)

    products: Mapped[list["Product"]] = relationship(back_populates="restaurant", cascade="all, delete-orphan")


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    restaurant_id: Mapped[int] = mapped_column(ForeignKey("restaurants.id", ondelete="CASCADE"), index=True)
    category: Mapped[str] = mapped_column(String(80), index=True)
    name: Mapped[str] = mapped_column(String(180), index=True)
    description: Mapped[str] = mapped_column(Text)
    price: Mapped[float] = mapped_column(Numeric(10, 2))

    restaurant: Mapped[Restaurant] = relationship(back_populates="products")
