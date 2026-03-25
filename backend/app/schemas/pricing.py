from pydantic import BaseModel


class PricingSummaryRead(BaseModel):
    subtotal: float
    commercial_discount_total: float
    financial_discount_total: float
    delivery_fee: float
    service_fee: float
    total: float
