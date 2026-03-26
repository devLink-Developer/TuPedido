from pydantic import BaseModel, Field


class AddressBase(BaseModel):
    label: str = Field(min_length=1, max_length=80)
    postal_code: str | None = Field(default=None, min_length=4, max_length=20)
    province: str | None = Field(default=None, min_length=1, max_length=120)
    locality: str | None = Field(default=None, min_length=1, max_length=120)
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
    postal_code: str | None = None
    province: str | None = None
    locality: str | None = None
    street: str
    details: str
    latitude: float | None = None
    longitude: float | None = None
    is_default: bool

    model_config = {"from_attributes": True}


class PostalCodeLocality(BaseModel):
    name: str
    latitude: float | None = None
    longitude: float | None = None


class PostalCodeLookupRead(BaseModel):
    postal_code: str
    province: str
    localities: list[PostalCodeLocality]


class AddressGeocodeRequest(BaseModel):
    postal_code: str = Field(min_length=4, max_length=20)
    province: str = Field(min_length=1, max_length=120)
    locality: str = Field(min_length=1, max_length=120)
    street_name: str = Field(min_length=1, max_length=180)
    street_number: str = Field(min_length=1, max_length=30)


class AddressGeocodeRead(BaseModel):
    latitude: float
    longitude: float
    display_name: str | None = None
