from pydantic import BaseModel


class ProductRead(BaseModel):
    id: int
    name: str
    description: str
    category: str
    price: float

    model_config = {"from_attributes": True}


class RestaurantRead(BaseModel):
    id: int
    slug: str
    name: str
    cuisine: str
    description: str
    eta_minutes: str
    rating: float
    delivery_fee: str
    cover_image: str
    products: list[ProductRead] = []

    model_config = {"from_attributes": True}


class RestaurantCreate(BaseModel):
    name: str
    category_id: int
    address: str
    logo_url: str | None = None


class RestaurantCreateResponse(BaseModel):
    id: int
    slug: str
    name: str
