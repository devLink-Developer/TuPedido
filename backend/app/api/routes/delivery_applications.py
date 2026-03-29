from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user
from app.api.presenters import serialize_delivery_application
from app.db.session import get_db
from app.models.delivery import DeliveryApplication
from app.models.user import User
from app.schemas.delivery import DeliveryApplicationCreate

router = APIRouter()


@router.get("")
def list_my_delivery_applications(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[dict[str, object]]:
    applications = db.scalars(
        select(DeliveryApplication)
        .options(selectinload(DeliveryApplication.user), selectinload(DeliveryApplication.store))
        .where(DeliveryApplication.user_id == user.id)
        .order_by(DeliveryApplication.id.desc())
    ).all()
    return [serialize_delivery_application(application).model_dump() for application in applications]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_delivery_application(
    payload: DeliveryApplicationCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="Public rider applications are disabled. Riders are now created by merchants.",
    )

    active_application = db.scalar(
        select(DeliveryApplication).where(
            DeliveryApplication.user_id == user.id,
            DeliveryApplication.status.in_(("pending_review", "approved", "suspended")),
        )
    )
    if active_application is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="You already have an active delivery application")

    if payload.vehicle_type in {"motorcycle", "car"} and (not payload.license_number or not payload.vehicle_plate):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="License number and vehicle plate are required for motor vehicles",
        )

    application = DeliveryApplication(user_id=user.id, **payload.model_dump(), status="pending_review")
    db.add(application)
    db.commit()
    db.refresh(application)
    application = db.scalar(
        select(DeliveryApplication)
        .options(selectinload(DeliveryApplication.user))
        .where(DeliveryApplication.id == application.id)
    )
    assert application is not None
    return serialize_delivery_application(application).model_dump()
