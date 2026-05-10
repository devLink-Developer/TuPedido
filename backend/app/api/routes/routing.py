from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.routing import DirectionsRead, DirectionsRequest
from app.services.routing import RoutingError, RoutingNotConfigured, duration_minutes, fetch_directions

router = APIRouter()


@router.post("/directions", response_model=DirectionsRead)
def get_directions(payload: DirectionsRequest, _: User = Depends(get_current_user)) -> DirectionsRead:
    try:
        result = fetch_directions(payload.profile, payload.coordinates)
    except RoutingNotConfigured as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except RoutingError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    return DirectionsRead(
        profile=result.profile,
        distance_meters=result.distance_meters,
        duration_seconds=result.duration_seconds,
        duration_minutes=duration_minutes(result.duration_seconds),
        geometry=result.geometry,
    )

