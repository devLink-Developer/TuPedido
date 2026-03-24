from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user
from app.api.presenters import serialize_application
from app.db.session import get_db
from app.models.store import Category
from app.models.user import MerchantApplication, User
from app.schemas.merchant import MerchantApplicationCreate

router = APIRouter()


def attach_requested_categories(db: Session, application: MerchantApplication) -> MerchantApplication:
    category_ids = list(application.requested_category_ids or [])
    if category_ids:
        categories = db.scalars(select(Category).where(Category.id.in_(category_ids))).all()
    else:
        categories = []
    setattr(application, "requested_categories", categories)
    return application


@router.get("")
def list_my_applications(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[dict[str, object]]:
    applications = db.scalars(
        select(MerchantApplication)
        .options(selectinload(MerchantApplication.store))
        .where(MerchantApplication.user_id == user.id)
        .order_by(MerchantApplication.id.desc())
    ).all()
    return [serialize_application(attach_requested_categories(db, application)).model_dump() for application in applications]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_application(
    payload: MerchantApplicationCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    requested_category_ids = list(payload.requested_category_ids or [])
    if requested_category_ids:
        found_ids = set(
            db.scalars(select(Category.id).where(Category.id.in_(requested_category_ids))).all()
        )
        missing = [category_id for category_id in requested_category_ids if category_id not in found_ids]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown category ids: {', '.join(str(item) for item in missing)}",
            )

    active_application = db.scalar(
        select(MerchantApplication).where(
            MerchantApplication.user_id == user.id,
            MerchantApplication.status.in_(["pending_review", "approved", "suspended"]),
        )
    )
    if active_application is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have an active merchant application",
        )

    application = MerchantApplication(
        user_id=user.id,
        business_name=payload.business_name,
        description=payload.description,
        address=payload.address,
        phone=payload.phone,
        logo_url=payload.logo_url,
        cover_image_url=payload.cover_image_url,
        requested_category_ids=requested_category_ids,
        status="pending_review",
    )
    db.add(application)
    db.commit()
    db.refresh(application)
    return serialize_application(attach_requested_categories(db, application)).model_dump()
