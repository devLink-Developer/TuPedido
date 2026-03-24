from pydantic import BaseModel


class AddressCreate(BaseModel):
    label: str
    street: str
    details: str
    latitude: float | None = None
    longitude: float | None = None
    is_default: bool = False


class AddressUpdate(BaseModel):
    label: str
    street: str
    details: str
    latitude: float | None = None
    longitude: float | None = None
    is_default: bool = False


class AddressRead(BaseModel):
    id: int
    label: str
    street: str
    details: str
    latitude: float | None = None
    longitude: float | None = None
    is_default: bool

    model_config = {"from_attributes": True}
