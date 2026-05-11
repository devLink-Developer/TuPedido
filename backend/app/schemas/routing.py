from typing import Literal

from pydantic import BaseModel, Field


RouteProfile = Literal["driving-car", "cycling-regular", "foot-walking"]


class RouteCoordinate(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class DirectionsRequest(BaseModel):
    profile: RouteProfile = "driving-car"
    coordinates: list[RouteCoordinate] = Field(min_length=2, max_length=5)


class RouteInstruction(BaseModel):
    instruction: str
    name: str | None = None
    distance_meters: float
    duration_seconds: float
    duration_minutes: int
    type: int | None = None
    way_points: list[int] = Field(default_factory=list)


class DirectionsRead(BaseModel):
    provider: Literal["openrouteservice"] = "openrouteservice"
    profile: RouteProfile
    distance_meters: float
    duration_seconds: float
    duration_minutes: int
    geometry: list[RouteCoordinate]
    instructions: list[RouteInstruction] = Field(default_factory=list)
