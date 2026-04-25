import logging
from datetime import UTC, datetime, time

from sqlalchemy import select

from app.core.config import settings
from app.core.security import hash_password, verify_password
from app.core.utils import encrypt_sensitive_value, slugify
from app.db.session import SessionLocal
from app.models.delivery import DeliveryApplication, DeliveryProfile, DeliveryZone, DeliveryZoneRate
from app.models.platform import PaymentProvider, PlatformSettings
from app.models.store import (
    Category,
    MerchantPaymentAccount,
    Product,
    ProductCategory,
    ProductSubcategory,
    Store,
    StoreCategoryLink,
    StoreDeliverySettings,
    StoreHour,
    StorePaymentSettings,
)
from app.models.user import Address, MerchantApplication, User
from app.services.platform import DEFAULT_CATALOG_BANNER_HEIGHT, DEFAULT_CATALOG_BANNER_WIDTH
from app.services.store_address import build_store_address

logger = logging.getLogger(__name__)

DEMO_ADMIN_LEGACY_EMAILS = (
    "admin@kepedimos.example.com",
    "admin@tupedido.example.com",
    "admin@tupedido.local",
)

LEGACY_SEED_EMAILS: dict[str, tuple[str, ...]] = {
    "cliente@kepedimos.example.com": ("cliente@tupedido.example.com",),
    "merchant@kepedimos.example.com": ("merchant@tupedido.example.com",),
    "applicant@kepedimos.example.com": ("applicant@tupedido.example.com",),
    "delivery@kepedimos.example.com": ("delivery@tupedido.example.com",),
}

SIMULATED_MERCADOPAGO_WEBHOOK_SECRET = "SIMULATED-WEBHOOK-SECRET"


def _default_admin_seed() -> dict[str, object]:
    return {
        "full_name": settings.bootstrap_admin_full_name,
        "email": settings.bootstrap_admin_email,
        "password": settings.bootstrap_admin_password,
        "role": "admin",
        "address": (
            settings.bootstrap_admin_address_label,
            settings.bootstrap_admin_address_street,
            settings.bootstrap_admin_address_details,
        ),
    }


def _legacy_seed_emails_for(email: str) -> tuple[str, ...]:
    if email == settings.bootstrap_admin_email:
        return tuple(candidate for candidate in DEMO_ADMIN_LEGACY_EMAILS if candidate != email)
    return tuple(candidate for candidate in LEGACY_SEED_EMAILS.get(email, ()) if candidate != email)


def _get_seed_user(db, email: str) -> User | None:
    user = db.scalar(select(User).where(User.email == email))
    if user is not None:
        return user

    for legacy_email in _legacy_seed_emails_for(email):
        user = db.scalar(select(User).where(User.email == legacy_email))
        if user is not None:
            user.email = email
            db.flush()
            return user
    return None


def _ensure_seed_address(
    db,
    *,
    user: User,
    address_seed: tuple[str, str, str],
    latitude: float | None = None,
    longitude: float | None = None,
) -> bool:
    address = db.scalar(select(Address).where(Address.user_id == user.id).limit(1))
    if address is not None:
        return False

    address = Address(
        user_id=user.id,
        label=address_seed[0],
        street=address_seed[1],
        details=address_seed[2],
        latitude=latitude,
        longitude=longitude,
        is_default=True,
    )
    db.add(address)
    return True


def _next_store_slug(db, base_slug: str) -> str:
    slug = base_slug
    suffix = 2
    while db.scalar(select(Store.id).where(Store.slug == slug).limit(1)) is not None:
        slug = f"{base_slug}-{suffix}"
        suffix += 1
    return slug


def ensure_default_admin() -> dict[str, object]:
    seed = _default_admin_seed()
    email = str(seed["email"])

    if not settings.bootstrap_admin_enabled:
        logger.info(
            "Bootstrap admin skipped at startup because BOOTSTRAP_ADMIN_ENABLED=false for email '%s'.",
            email,
        )
        return {"status": "disabled", "email": email, "deactivated_legacy_demo_admins": 0}

    address_values = seed["address"]
    if not isinstance(address_values, tuple):
        raise TypeError("Default admin address configuration is invalid")

    db = SessionLocal()
    try:
        user = db.scalar(select(User).where(User.email == email))
        migrated_from = None
        created = False

        if user is None:
            for legacy_email in _legacy_seed_emails_for(email):
                legacy_user = db.scalar(select(User).where(User.email == legacy_email))
                if legacy_user is None:
                    continue
                legacy_user.email = email
                db.flush()
                user = legacy_user
                migrated_from = legacy_email
                break

        if user is None:
            user = User(
                full_name=str(seed["full_name"]),
                email=email,
                hashed_password=hash_password(str(seed["password"])),
                role="admin",
                is_active=True,
                must_change_password=False,
            )
            db.add(user)
            db.flush()
            created = True

        needs_refresh = (
            user.full_name != str(seed["full_name"])
            or user.role != "admin"
            or not user.is_active
            or user.must_change_password
            or not verify_password(str(seed["password"]), user.hashed_password)
        )
        created_address = False

        if created or migrated_from is not None or needs_refresh:
            user.full_name = str(seed["full_name"])
            user.hashed_password = hash_password(str(seed["password"]))
            user.role = "admin"
            user.is_active = True
            user.must_change_password = False

        created_address = _ensure_seed_address(
            db,
            user=user,
            address_seed=(
                str(address_values[0]),
                str(address_values[1]),
                str(address_values[2]),
            ),
        )

        action = "already_correct"
        if created:
            action = "created"
        elif migrated_from is not None:
            action = "migrated"
        elif needs_refresh or created_address:
            action = "reactivated"

        deactivated_legacy_demo_admins = 0
        for legacy_email in _legacy_seed_emails_for(email):
            legacy_user = db.scalar(select(User).where(User.email == legacy_email))
            if legacy_user is None or not legacy_user.is_active:
                continue
            legacy_user.is_active = False
            deactivated_legacy_demo_admins += 1

        db.commit()
        log = logger.info if action == "already_correct" and deactivated_legacy_demo_admins == 0 else logger.warning
        log(
            "Bootstrap admin status=%s email='%s' deactivated_legacy_demo_admins=%s. Change BOOTSTRAP_ADMIN_* values in production.",
            action,
            email,
            deactivated_legacy_demo_admins,
        )
        return {
            "status": action,
            "email": email,
            "deactivated_legacy_demo_admins": deactivated_legacy_demo_admins,
        }
    finally:
        db.close()


def seed_initial_data() -> int:
    db = SessionLocal()
    replenished = 0
    try:
        platform_settings = db.scalar(select(PlatformSettings).where(PlatformSettings.id == 1))
        if platform_settings is None:
            db.add(
                PlatformSettings(
                    id=1,
                    service_fee_amount=350,
                    platform_logo_url=None,
                    platform_wordmark_url=None,
                    platform_favicon_url=None,
                    platform_use_logo_as_favicon=False,
                    catalog_banner_image_url=None,
                    catalog_banner_width=DEFAULT_CATALOG_BANNER_WIDTH,
                    catalog_banner_height=DEFAULT_CATALOG_BANNER_HEIGHT,
                )
            )
            replenished += 1

        redirect_uri = settings.mercadopago_redirect_uri or (
            f"{settings.backend_base_url.rstrip('/')}{settings.api_prefix}/oauth/mercadopago/callback"
        )
        payment_provider = db.scalar(select(PaymentProvider).where(PaymentProvider.provider == "mercadopago"))
        if payment_provider is None:
            webhook_secret = settings.mercadopago_webhook_secret or (
                SIMULATED_MERCADOPAGO_WEBHOOK_SECRET if settings.mercadopago_simulated else None
            )
            payment_provider = PaymentProvider(
                provider="mercadopago",
                client_id=settings.mercadopago_client_id or "SIMULATED-CLIENT-ID",
                client_secret_encrypted=encrypt_sensitive_value(
                    settings.mercadopago_client_secret or "SIMULATED-CLIENT-SECRET"
                ),
                webhook_secret_encrypted=encrypt_sensitive_value(webhook_secret) if webhook_secret else None,
                redirect_uri=redirect_uri,
                enabled=bool(settings.mercadopago_simulated) or bool(
                    settings.mercadopago_client_id
                    and settings.mercadopago_client_secret
                    and settings.mercadopago_webhook_secret
                    and settings.mercadopago_redirect_uri
                ),
                mode="sandbox",
            )
            db.add(payment_provider)
            replenished += 1
        elif settings.mercadopago_webhook_secret and not payment_provider.webhook_secret_encrypted:
            payment_provider.webhook_secret_encrypted = encrypt_sensitive_value(settings.mercadopago_webhook_secret)
            replenished += 1

        base_categories = [
            {
                "name": "Despensa",
                "description": "Compras rapidas, almacen y productos de consumo diario.",
                "color": "#FF7043",
                "color_light": "#FBE9E7",
                "icon": "DS",
            },
            {
                "name": "Kiosko",
                "description": "Bebidas, snacks, cigarrillos y compras de ultimo momento.",
                "color": "#29B6F6",
                "color_light": "#E1F5FE",
                "icon": "KS",
            },
            {
                "name": "Farmacia",
                "description": "Salud, cuidado personal y medicamentos de mostrador.",
                "color": "#66BB6A",
                "color_light": "#E8F5E9",
                "icon": "FX",
            },
            {
                "name": "Carniceria",
                "description": "Cortes frescos y preparados para cocinar.",
                "color": "#EF5350",
                "color_light": "#FFEBEE",
                "icon": "CR",
            },
            {
                "name": "Polleria",
                "description": "Especialistas en pollo fresco y rotiseria.",
                "color": "#FFCA28",
                "color_light": "#FFF8E1",
                "icon": "PL",
            },
            {
                "name": "Restaurante",
                "description": "Comidas preparadas y menus completos.",
                "color": "#AB47BC",
                "color_light": "#F3E5F5",
                "icon": "RT",
            },
        ]
        categories_by_name: dict[str, Category] = {}
        for sort_order, item in enumerate(base_categories, start=1):
            name = item["name"]
            slug = slugify(name)
            category = db.scalar(select(Category).where(Category.slug == slug))
            if category is None:
                category = Category(
                    name=name,
                    slug=slug,
                    description=item["description"],
                    color=item["color"],
                    color_light=item["color_light"],
                    icon=item["icon"],
                    is_active=True,
                    sort_order=sort_order,
                )
                db.add(category)
                db.flush()
                replenished += 1
            categories_by_name[name] = category

        users_seed = [
            {
                "full_name": "Cliente Demo",
                "email": "cliente@kepedimos.example.com",
                "password": "cliente123",
                "role": "customer",
                "address": ("Casa", "Av. Cabildo 2450", "Depto 6A, CABA"),
            },
            {
                "full_name": "Comercio Demo",
                "email": "merchant@kepedimos.example.com",
                "password": "merchant123",
                "role": "merchant",
                "address": ("Local", "Amenabar 1234", "Belgrano, CABA"),
            },
            {
                "full_name": "Aspirante Comercio",
                "email": "applicant@kepedimos.example.com",
                "password": "applicant123",
                "role": "customer",
                "address": ("Casa", "Conesa 800", "Nunez, CABA"),
            },
            {
                "full_name": "Rider Demo",
                "email": "delivery@kepedimos.example.com",
                "password": "delivery123",
                "role": "delivery",
                "address": ("Base", "Juramento 1500", "Belgrano, CABA"),
            },
        ]
        users_by_email: dict[str, User] = {}
        for item in users_seed:
            user = _get_seed_user(db, str(item["email"]))
            if user is None:
                user = User(
                    full_name=str(item["full_name"]),
                    email=str(item["email"]),
                    hashed_password=hash_password(str(item["password"])),
                    role=str(item["role"]),
                    is_active=True,
                )
                db.add(user)
                db.flush()
                replenished += 1
            users_by_email[str(item["email"])] = user

            if _ensure_seed_address(
                db,
                user=user,
                address_seed=item["address"],
                latitude=-34.5620 + (user.id * 0.001),
                longitude=-58.4550 - (user.id * 0.001),
            ):
                replenished += 1

        merchant_user = users_by_email["merchant@kepedimos.example.com"]
        store = db.scalar(select(Store).where(Store.owner_user_id == merchant_user.id))
        if store is None:
            requested_slug = "almacen-belgrano"
            slug_owner = db.scalar(select(Store).where(Store.slug == requested_slug))
            if slug_owner is not None and slug_owner.owner_user_id != merchant_user.id:
                requested_slug = _next_store_slug(db, requested_slug)

            store = Store(
                owner_user_id=merchant_user.id,
                slug=requested_slug,
                name="Almacen Belgrano",
                description="Despensa y kiosko de cercania con envios rapidos y retiro en local.",
                address=build_store_address(
                    street_line="Amenabar 1234",
                    locality="CABA",
                    province="CABA",
                    postal_code="1426",
                ),
                postal_code="1426",
                province="CABA",
                locality="CABA",
                phone="+54 11 5555 1234",
                logo_url="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80",
                cover_image_url="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80",
                latitude=-34.5627,
                longitude=-58.4565,
                status="approved",
                accepting_orders=True,
                opening_note="Entregas en 20 a 35 minutos.",
                min_delivery_minutes=20,
                max_delivery_minutes=35,
                rating=4.8,
                rating_count=148,
            )
            db.add(store)
            db.flush()
            replenished += 1

        desired_category_links = {
            categories_by_name["Despensa"].id: True,
            categories_by_name["Kiosko"].id: False,
        }
        existing_category_links = {
            link.category_id: link
            for link in db.scalars(select(StoreCategoryLink).where(StoreCategoryLink.store_id == store.id)).all()
        }
        for category_id, is_primary in desired_category_links.items():
            if category_id in existing_category_links:
                continue
            db.add(StoreCategoryLink(store_id=store.id, category_id=category_id, is_primary=is_primary))
            replenished += 1

        if store.delivery_settings is None:
            db.add(
                StoreDeliverySettings(
                    store_id=store.id,
                    delivery_enabled=True,
                    pickup_enabled=True,
                    delivery_fee=350,
                    free_delivery_min_order=5000,
                    rider_fee=220,
                    min_order=0,
                )
            )
            replenished += 1

        if store.payment_settings is None:
            db.add(StorePaymentSettings(store_id=store.id, cash_enabled=True, mercadopago_enabled=True))
            replenished += 1

        merchant_payment_account = db.scalar(
            select(MerchantPaymentAccount).where(
                MerchantPaymentAccount.store_id == store.id,
                MerchantPaymentAccount.provider == "mercadopago",
            )
        )
        if merchant_payment_account is None:
            db.add(
                MerchantPaymentAccount(
                    store_id=store.id,
                    provider="mercadopago",
                    public_key="APP_USR-TEST-1234",
                    access_token_encrypted=encrypt_sensitive_value("TEST-ACCESS-TOKEN-1234"),
                    refresh_token_encrypted=encrypt_sensitive_value("TEST-REFRESH-TOKEN-1234"),
                    mp_user_id="123456789",
                    expires_in=15552000,
                    scope="offline_access payments write",
                    live_mode=False,
                    token_expires_at=datetime(2099, 1, 1, tzinfo=UTC),
                    connected=True,
                    onboarding_completed=True,
                    reconnect_required=False,
                )
            )
            replenished += 1

        zone = db.scalar(select(DeliveryZone).where(DeliveryZone.name == "CABA Norte"))
        if zone is None:
            zone = DeliveryZone(
                name="CABA Norte",
                description="Cobertura operativa inicial para Belgrano, Nunez y alrededores.",
                center_latitude=-34.5598,
                center_longitude=-58.4548,
                radius_km=6,
                is_active=True,
            )
            db.add(zone)
            db.flush()
            replenished += 1

        desired_zone_rates = {
            "bicycle": {"delivery_fee_customer": 2.5, "rider_fee": 1.6},
            "motorcycle": {"delivery_fee_customer": 3.5, "rider_fee": 2.2},
            "car": {"delivery_fee_customer": 4.8, "rider_fee": 3.1},
        }
        existing_zone_rates = {
            rate.vehicle_type: rate
            for rate in db.scalars(select(DeliveryZoneRate).where(DeliveryZoneRate.zone_id == zone.id)).all()
        }
        for vehicle_type, values in desired_zone_rates.items():
            if vehicle_type in existing_zone_rates:
                continue
            db.add(
                DeliveryZoneRate(
                    zone_id=zone.id,
                    vehicle_type=vehicle_type,
                    delivery_fee_customer=values["delivery_fee_customer"],
                    rider_fee=values["rider_fee"],
                )
            )
            replenished += 1

        existing_hours = {hour.day_of_week for hour in store.hours}
        for day in range(7):
            if day in existing_hours:
                continue
            db.add(
                StoreHour(
                    store_id=store.id,
                    day_of_week=day,
                    opens_at=time(hour=0),
                    closes_at=time(hour=23, minute=59),
                    is_closed=False,
                )
            )
            replenished += 1

        category_taxonomy_seed = {
            "Promos": ["Combos", "Oportunidades"],
            "Despensa": ["Yerbas", "Almacen"],
            "Bebidas": ["Gaseosas", "Aguas"],
        }
        for index, (category_name, subcategory_names) in enumerate(category_taxonomy_seed.items()):
            category_slug = slugify(category_name)
            product_category = db.scalar(
                select(ProductCategory).where(
                    ProductCategory.store_id == store.id,
                    ProductCategory.slug == category_slug,
                )
            )
            if product_category is None:
                product_category = ProductCategory(
                    store_id=store.id,
                    name=category_name,
                    slug=category_slug,
                    sort_order=index,
                )
                db.add(product_category)
                db.flush()
                replenished += 1
            for sub_index, subcategory_name in enumerate(subcategory_names):
                subcategory_slug = slugify(subcategory_name)
                subcategory = db.scalar(
                    select(ProductSubcategory).where(
                        ProductSubcategory.product_category_id == product_category.id,
                        ProductSubcategory.slug == subcategory_slug,
                    )
                )
                if subcategory is not None:
                    continue
                db.add(
                    ProductSubcategory(
                        product_category_id=product_category.id,
                        name=subcategory_name,
                        slug=subcategory_slug,
                        sort_order=sub_index,
                    )
                )
                replenished += 1

        db.flush()
        product_categories = {
            item.slug: item
            for item in db.scalars(select(ProductCategory).where(ProductCategory.store_id == store.id)).all()
        }
        product_subcategories = {
            f"{item.product_category.slug}:{item.slug}": item
            for item in db.scalars(
                select(ProductSubcategory)
                .join(ProductSubcategory.product_category)
                .where(ProductCategory.store_id == store.id)
            ).all()
        }
        products_seed = [
            ("Combo Ahorro", "Promo del dia con gaseosa y snack.", 8.9, None, "promos", "combos"),
            ("Yerba Premium 1kg", "Ideal para mate de todos los dias.", 6.4, None, "despensa", "yerbas"),
            ("Gaseosa Cola 1.5L", "Bebida fria lista para delivery.", 3.25, None, "bebidas", "gaseosas"),
        ]
        for index, (name, description, price, compare_at, category_slug, subcategory_slug) in enumerate(products_seed):
            product = db.scalar(select(Product).where(Product.store_id == store.id, Product.name == name))
            if product is not None:
                continue
            db.add(
                Product(
                    store_id=store.id,
                    product_category_id=product_categories[category_slug].id,
                    product_subcategory_id=product_subcategories[f"{category_slug}:{subcategory_slug}"].id,
                    name=name,
                    description=description,
                    price=price,
                    compare_at_price=compare_at,
                    image_url=None,
                    is_available=True,
                    sort_order=index,
                )
            )
            replenished += 1

        applicant_user = users_by_email["applicant@kepedimos.example.com"]
        application = db.scalar(select(MerchantApplication).where(MerchantApplication.user_id == applicant_user.id))
        if application is None:
            db.add(
                MerchantApplication(
                    user_id=applicant_user.id,
                    business_name="Farmacia Norte",
                    description="Farmacia de turno con retiro y delivery en zona norte.",
                    address="Conesa 800, Nunez, CABA",
                    phone="+54 11 4444 9999",
                    requested_category_ids=[categories_by_name["Farmacia"].id],
                    status="pending_review",
                )
            )
            replenished += 1

        rider_user = users_by_email["delivery@kepedimos.example.com"]
        rider_application = db.scalar(select(DeliveryApplication).where(DeliveryApplication.user_id == rider_user.id))
        if rider_application is None:
            rider_application = DeliveryApplication(
                user_id=rider_user.id,
                store_id=store.id,
                phone="+54 11 3333 1234",
                vehicle_type="motorcycle",
                dni_number="30111222",
                emergency_contact_name="Maria Rider",
                emergency_contact_phone="+54 11 3333 9999",
                license_number="LIC-998877",
                vehicle_plate="AA123BB",
                insurance_policy="Seguro Demo 123",
                status="approved",
            )
            db.add(rider_application)
            db.flush()
            replenished += 1

        rider_profile = db.get(DeliveryProfile, rider_user.id)
        if rider_profile is None:
            db.add(
                DeliveryProfile(
                    user_id=rider_user.id,
                    application_id=rider_application.id,
                    store_id=rider_application.store_id or store.id,
                    phone=rider_application.phone or "+54 11 3333 1234",
                    vehicle_type=rider_application.vehicle_type or "motorcycle",
                    photo_url=None,
                    dni_number=rider_application.dni_number or "30111222",
                    emergency_contact_name=rider_application.emergency_contact_name or "Maria Rider",
                    emergency_contact_phone=rider_application.emergency_contact_phone or "+54 11 3333 9999",
                    license_number=rider_application.license_number or "LIC-998877",
                    vehicle_plate=rider_application.vehicle_plate or "AA123BB",
                    insurance_policy=rider_application.insurance_policy or "Seguro Demo 123",
                    availability="idle",
                    is_active=True,
                    current_zone_id=zone.id,
                    current_latitude=-34.5615,
                    current_longitude=-58.4555,
                    push_enabled=False,
                )
            )
            replenished += 1

        db.commit()
        return replenished
    finally:
        db.close()
