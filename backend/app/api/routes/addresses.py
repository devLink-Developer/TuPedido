from sqlalchemy import select
from sqlalchemy.orm import Session

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import Address, User
from app.schemas.address import (
    AddressCreate,
    AddressGeocodeRead,
    AddressGeocodeRequest,
    AddressReverseGeocodeRead,
    AddressReverseGeocodeRequest,
    AddressRead,
    AddressUpdate,
    PostalCodeLocality,
    PostalCodeLookupRead,
)
from app.services.address_lookup import (
    AddressLookupError,
    AddressLookupNotFound,
    geocode_address,
    lookup_postal_code,
    reverse_geocode_coordinates,
)

router = APIRouter()


def normalize_default_flag(db: Session, user_id: int, address_id: int | None = None) -> None:
    addresses = db.scalars(select(Address).where(Address.user_id == user_id)).all()
    for address in addresses:
        address.is_default = address.id == address_id


@router.get("", response_model=list[AddressRead])
def list_addresses(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[AddressRead]:
    addresses = db.scalars(select(Address).where(Address.user_id == user.id).order_by(Address.id)).all()
    return [AddressRead.model_validate(address) for address in addresses]


@router.get("/postal-code/{postal_code}", response_model=PostalCodeLookupRead)
def get_postal_code_lookup(postal_code: str, _: User = Depends(get_current_user)) -> PostalCodeLookupRead:
    try:
        result = lookup_postal_code(postal_code)
    except AddressLookupNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except AddressLookupError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    return PostalCodeLookupRead(
        postal_code=result.postal_code,
        province=result.province,
        localities=[
            PostalCodeLocality(name=item.name, latitude=item.latitude, longitude=item.longitude)
            for item in result.localities
        ],
    )


@router.post("/geocode", response_model=AddressGeocodeRead)
def geocode_customer_address(payload: AddressGeocodeRequest, _: User = Depends(get_current_user)) -> AddressGeocodeRead:
    try:
        result = geocode_address(
            postal_code=payload.postal_code,
            province=payload.province,
            locality=payload.locality,
            street_name=payload.street_name,
            street_number=payload.street_number,
        )
    except AddressLookupNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except AddressLookupError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    return AddressGeocodeRead(
        latitude=result.latitude,
        longitude=result.longitude,
        display_name=result.display_name,
    )


@router.post("/reverse-geocode", response_model=AddressReverseGeocodeRead)
def reverse_geocode_customer_address(
    payload: AddressReverseGeocodeRequest,
    _: User = Depends(get_current_user),
) -> AddressReverseGeocodeRead:
    try:
        result = reverse_geocode_coordinates(
            latitude=payload.latitude,
            longitude=payload.longitude,
        )
    except AddressLookupNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except AddressLookupError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    return AddressReverseGeocodeRead(
        street_name=result.street_name,
        street_number=result.street_number,
        display_name=result.display_name,
    )


@router.post("", response_model=AddressRead, status_code=status.HTTP_201_CREATED)
def create_address(payload: AddressCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> AddressRead:
    address = Address(
        user_id=user.id,
        label=payload.label.strip(),
        postal_code=payload.postal_code.strip() if payload.postal_code else None,
        province=payload.province.strip() if payload.province else None,
        locality=payload.locality.strip() if payload.locality else None,
        street=payload.street.strip(),
        details=payload.details.strip(),
        latitude=payload.latitude,
        longitude=payload.longitude,
        is_default=payload.is_default,
    )
    db.add(address)
    db.flush()
    if payload.is_default:
        normalize_default_flag(db, user.id, address.id)
    elif db.scalar(select(Address).where(Address.user_id == user.id, Address.id != address.id).limit(1)) is None:
        address.is_default = True
    db.commit()
    db.refresh(address)
    return AddressRead.model_validate(address)


@router.put("/{address_id}", response_model=AddressRead)
def update_address(address_id: int, payload: AddressUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> AddressRead:
    address = db.scalar(select(Address).where(Address.id == address_id, Address.user_id == user.id))
    if address is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Address not found")
    was_default = address.is_default
    address.label = payload.label.strip()
    if "postal_code" in payload.model_fields_set:
        address.postal_code = payload.postal_code.strip() if payload.postal_code else None
    if "province" in payload.model_fields_set:
        address.province = payload.province.strip() if payload.province else None
    if "locality" in payload.model_fields_set:
        address.locality = payload.locality.strip() if payload.locality else None
    address.street = payload.street.strip()
    address.details = payload.details.strip()
    address.latitude = payload.latitude
    address.longitude = payload.longitude
    address.is_default = payload.is_default
    if payload.is_default:
        normalize_default_flag(db, user.id, address.id)
    elif was_default:
        fallback = db.scalar(select(Address).where(Address.user_id == user.id, Address.id != address.id).order_by(Address.id))
        if fallback is None:
            address.is_default = True
        else:
            fallback.is_default = True
    db.commit()
    db.refresh(address)
    return AddressRead.model_validate(address)


@router.delete("/{address_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_address(address_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> None:
    address = db.scalar(select(Address).where(Address.id == address_id, Address.user_id == user.id))
    if address is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Address not found")
    was_default = address.is_default
    db.delete(address)
    db.flush()
    if was_default:
        fallback = db.scalar(select(Address).where(Address.user_id == user.id).order_by(Address.id))
        if fallback is not None:
            fallback.is_default = True
    db.commit()
