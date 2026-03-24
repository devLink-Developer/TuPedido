from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import require_admin
from app.db.session import get_db
from app.models.restaurant import Restaurant
from app.schemas.restaurant import RestaurantCreate, RestaurantCreateResponse, RestaurantRead

router = APIRouter()

CATEGORY_MAP = {
    1: "Italian",
    2: "Japanese",
    3: "Mexican",
    4: "French",
    5: "Fine Dining",
}


def build_slug(name: str) -> str:
    return "-".join(name.lower().strip().split())


@router.get("", response_model=list[RestaurantRead])
def list_restaurants(db: Session = Depends(get_db)) -> list[RestaurantRead]:
    restaurants = db.scalars(
        select(Restaurant).options(selectinload(Restaurant.products)).order_by(Restaurant.id)
    ).all()
    return [RestaurantRead.model_validate(item) for item in restaurants]


@router.get("/{slug}", response_model=RestaurantRead)
def get_restaurant(slug: str, db: Session = Depends(get_db)) -> RestaurantRead:
    restaurant = db.scalar(
        select(Restaurant)
        .options(selectinload(Restaurant.products))
        .where(Restaurant.slug == slug)
    )
    if restaurant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Restaurant not found")

    return RestaurantRead.model_validate(restaurant)


@router.post("", response_model=RestaurantCreateResponse, status_code=status.HTTP_201_CREATED)
def create_restaurant(
    payload: RestaurantCreate,
    db: Session = Depends(get_db),
    _: object = Depends(require_admin),
) -> RestaurantCreateResponse:
    slug = build_slug(payload.name)
    existing = db.scalar(select(Restaurant).where(Restaurant.slug == slug))
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Restaurant already exists")

    cuisine = CATEGORY_MAP.get(payload.category_id, "General")
    restaurant = Restaurant(
        slug=slug,
        name=payload.name,
        cuisine=cuisine,
        description=f"Direccion: {payload.address}",
        eta_minutes="25-35 min",
        rating=0,
        delivery_fee="Gratis",
        cover_image=payload.logo_url or "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
    )
    db.add(restaurant)
    db.commit()
    db.refresh(restaurant)

    return RestaurantCreateResponse(id=restaurant.id, slug=restaurant.slug, name=restaurant.name)
