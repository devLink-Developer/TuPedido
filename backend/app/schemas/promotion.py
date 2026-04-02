from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, model_validator


class PromotionItemWrite(BaseModel):
    product_id: int
    quantity: int = Field(ge=1)
    sort_order: int = 0


class PromotionWrite(BaseModel):
    name: str = Field(min_length=1, max_length=180)
    description: str | None = None
    sale_price: float = Field(ge=0)
    max_per_customer_per_day: int = Field(ge=1)
    is_active: bool = True
    sort_order: int = 0
    items: list[PromotionItemWrite] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_items(self) -> "PromotionWrite":
        seen_product_ids: set[int] = set()
        for item in self.items:
            if item.product_id in seen_product_ids:
                raise ValueError("Each product can only appear once in a promotion")
            seen_product_ids.add(item.product_id)
        return self


class PromotionItemRead(BaseModel):
    id: int
    product_id: int
    product_name: str
    quantity: int
    sort_order: int


class PromotionRead(BaseModel):
    id: int
    store_id: int
    name: str
    description: str | None = None
    sale_price: float
    max_per_customer_per_day: int
    is_active: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime
    items: list[PromotionItemRead]


class AppliedPromotionSummaryRead(BaseModel):
    promotion_id: int | None = None
    promotion_name: str
    combo_count: int
    sale_price: float
    base_total: float
    discount_total: float
    items: list[PromotionItemRead]
