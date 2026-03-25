from pydantic import BaseModel, Field


class AddressBase(BaseModel):
    label: str = Field(min_length=1, max_length=80)
    street: str = Field(min_length=1, max_length=255)
    details: str = Field(min_length=1)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    is_default: bool = False


class AddressCreate(AddressBase):
    pass


class AddressUpdate(AddressBase):
    pass


class AddressRead(BaseModel):
    id: int
    label: str
    street: str
    details: str
    latitude: float | None = None
    longitude: float | None = None
    is_default: bool

    model_config = {"from_attributes": True}
