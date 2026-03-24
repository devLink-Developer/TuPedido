from sqlalchemy import select
from sqlalchemy.orm import Session

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import Address, User
from app.schemas.address import AddressCreate, AddressRead, AddressUpdate

router = APIRouter()


def normalize_default_flag(db: Session, user_id: int, address_id: int | None = None) -> None:
    addresses = db.scalars(select(Address).where(Address.user_id == user_id)).all()
    for address in addresses:
        address.is_default = address.id == address_id


@router.get("", response_model=list[AddressRead])
def list_addresses(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[AddressRead]:
    addresses = db.scalars(select(Address).where(Address.user_id == user.id).order_by(Address.id)).all()
    return [AddressRead.model_validate(address) for address in addresses]


@router.post("", response_model=AddressRead, status_code=status.HTTP_201_CREATED)
def create_address(payload: AddressCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> AddressRead:
    address = Address(
        user_id=user.id,
        label=payload.label,
        street=payload.street,
        details=payload.details,
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
    address.label = payload.label
    address.street = payload.street
    address.details = payload.details
    address.latitude = payload.latitude
    address.longitude = payload.longitude
    address.is_default = payload.is_default
    if payload.is_default:
        normalize_default_flag(db, user.id, address.id)
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
