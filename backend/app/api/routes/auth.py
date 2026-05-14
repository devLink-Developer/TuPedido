from secrets import token_urlsafe

from sqlalchemy import delete, update
from sqlalchemy.orm import Session

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.api.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.delivery import DeliveryApplication, DeliveryAssignment, DeliveryProfile, NotificationEvent, PushSubscription
from app.models.order import OrderReview, StoreOrder
from app.models.store import Store
from app.models.user import User
from app.schemas.auth import AuthResponse, ChangePasswordRequest, LoginRequest, RegisterRequest, UserRead
from app.services.user_compat import create_user_compat, find_user_by_email, set_user_password

router = APIRouter()


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> AuthResponse:
    user = find_user_by_email(db, payload.email)
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    return AuthResponse(access_token=create_access_token(user.email), user=UserRead.model_validate(user))


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> AuthResponse:
    existing_user = find_user_by_email(db, payload.email)
    if existing_user is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = create_user_compat(
        db,
        full_name=payload.full_name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role="customer",
    )
    db.commit()

    return AuthResponse(access_token=create_access_token(user.email), user=UserRead.model_validate(user))


@router.get("/me", response_model=UserRead)
def me(user: User = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(user)


@router.post("/change-password", response_model=UserRead)
def change_password(
    payload: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserRead:
    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New password must be different")

    set_user_password(
        db,
        user=user,
        hashed_password=hash_password(payload.new_password),
        must_change_password=False,
    )
    db.commit()
    return UserRead.model_validate(user)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_me(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    deleted_email = f"deleted-user-{user.id}@deleted.kepedimos.com"

    if user.cart is not None:
        db.delete(user.cart)

    for address in list(user.addresses):
        db.delete(address)

    db.execute(delete(NotificationEvent).where(NotificationEvent.user_id == user.id))
    db.execute(delete(PushSubscription).where(PushSubscription.user_id == user.id))

    db.execute(
        update(StoreOrder)
        .where(StoreOrder.user_id == user.id)
        .values(
            customer_name_snapshot="Cuenta eliminada",
            address_id=None,
            address_label_snapshot=None,
            address_full_snapshot=None,
            review_prompt_enabled=False,
        )
    )
    db.execute(
        update(StoreOrder)
        .where(StoreOrder.assigned_rider_id == user.id)
        .values(
            assigned_rider_name_snapshot="Repartidor eliminado",
            assigned_rider_phone_masked=None,
            assigned_rider_vehicle_type=None,
            tracking_last_latitude=None,
            tracking_last_longitude=None,
            tracking_last_at=None,
            tracking_stale=True,
        )
    )
    db.execute(
        update(DeliveryAssignment)
        .where(DeliveryAssignment.rider_user_id == user.id)
        .values(
            rider_user_id=None,
            current_latitude=None,
            current_longitude=None,
            current_heading=None,
            current_speed_kmh=None,
            last_heartbeat_at=None,
            tracking_stale=True,
        )
    )
    db.execute(
        update(DeliveryProfile)
        .where(DeliveryProfile.user_id == user.id)
        .values(
            phone="",
            photo_url=None,
            dni_number="",
            emergency_contact_name="",
            emergency_contact_phone="",
            license_number=None,
            vehicle_plate=None,
            insurance_policy=None,
            availability="offline",
            is_active=False,
            current_latitude=None,
            current_longitude=None,
            last_location_at=None,
            push_enabled=False,
        )
    )
    db.execute(
        update(DeliveryApplication)
        .where(DeliveryApplication.user_id == user.id)
        .values(
            phone="",
            photo_url=None,
            dni_number="",
            emergency_contact_name="",
            emergency_contact_phone="",
            license_number=None,
            vehicle_plate=None,
            insurance_policy=None,
            notes=None,
            status="rejected",
            review_notes="Cuenta eliminada por solicitud del usuario.",
        )
    )
    db.execute(update(OrderReview).where(OrderReview.user_id == user.id).values(review_text=None))
    db.execute(update(OrderReview).where(OrderReview.rider_user_id == user.id).values(rider_user_id=None))
    db.execute(
        update(Store)
        .where(Store.owner_user_id == user.id)
        .values(
            status="suspended",
            accepting_orders=False,
            phone="",
            opening_note="Cuenta eliminada",
        )
    )

    user.full_name = "Cuenta eliminada"
    user.email = deleted_email
    user.hashed_password = hash_password(token_urlsafe(32))
    user.is_active = False
    user.must_change_password = False

    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
