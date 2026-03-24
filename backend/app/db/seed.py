from datetime import UTC, datetime, time

from sqlalchemy import select

from app.core.security import hash_password
from app.core.utils import encrypt_sensitive_value, slugify
from app.db.session import SessionLocal
from app.models.delivery import DeliveryApplication, DeliveryProfile, DeliveryZone, DeliveryZoneRate
from app.models.platform import PlatformSettings
from app.models.store import (
    Category,
    MercadoPagoCredential,
    Product,
    ProductCategory,
    Store,
    StoreCategoryLink,
    StoreDeliverySettings,
    StoreHour,
    StorePaymentSettings,
)
from app.models.user import Address, MerchantApplication, User


def seed_initial_data() -> None:
    db = SessionLocal()
    try:
        platform_settings = db.scalar(select(PlatformSettings).where(PlatformSettings.id == 1))
        if platform_settings is None:
            db.add(PlatformSettings(id=1, service_fee_amount=350))

        base_categories = [
            ("Despensa", "Compras rapidas, almacen y productos de consumo diario."),
            ("Kiosko", "Bebidas, snacks, cigarrillos y compras de ultimo momento."),
            ("Farmacia", "Salud, cuidado personal y medicamentos de mostrador."),
            ("Carniceria", "Cortes frescos y preparados para cocinar."),
            ("Polleria", "Especialistas en pollo fresco y rotiseria."),
            ("Restaurante", "Comidas preparadas y menus completos."),
        ]
        categories_by_name: dict[str, Category] = {}
        for sort_order, (name, description) in enumerate(base_categories, start=1):
            slug = slugify(name)
            category = db.scalar(select(Category).where(Category.slug == slug))
            if category is None:
                category = Category(name=name, slug=slug, description=description, sort_order=sort_order)
                db.add(category)
                db.flush()
            categories_by_name[name] = category

        users_seed = [
            {
                "full_name": "Admin TuPedido",
                "email": "admin@tupedido.example.com",
                "password": "admin1234",
                "role": "admin",
                "address": ("HQ", "Av. Corrientes 1000", "Piso 10, CABA"),
            },
            {
                "full_name": "Cliente Demo",
                "email": "cliente@tupedido.example.com",
                "password": "cliente123",
                "role": "customer",
                "address": ("Casa", "Av. Cabildo 2450", "Depto 6A, CABA"),
            },
            {
                "full_name": "Comercio Demo",
                "email": "merchant@tupedido.example.com",
                "password": "merchant123",
                "role": "merchant",
                "address": ("Local", "Amenabar 1234", "Belgrano, CABA"),
            },
            {
                "full_name": "Aspirante Comercio",
                "email": "applicant@tupedido.example.com",
                "password": "applicant123",
                "role": "customer",
                "address": ("Casa", "Conesa 800", "Nunez, CABA"),
            },
            {
                "full_name": "Rider Demo",
                "email": "delivery@tupedido.example.com",
                "password": "delivery123",
                "role": "delivery",
                "address": ("Base", "Juramento 1500", "Belgrano, CABA"),
            },
        ]
        users_by_email: dict[str, User] = {}
        for item in users_seed:
            user = db.scalar(select(User).where(User.email == item["email"]))
            if user is None:
                user = User(
                    full_name=item["full_name"],
                    email=item["email"],
                    hashed_password=hash_password(item["password"]),
                    role=item["role"],
                    is_active=True,
                )
                db.add(user)
                db.flush()
            else:
                user.full_name = item["full_name"]
                user.hashed_password = hash_password(item["password"])
                user.role = item["role"]
                user.is_active = True
            users_by_email[item["email"]] = user

            address = db.scalar(select(Address).where(Address.user_id == user.id).limit(1))
            if address is None:
                address = Address(
                    user_id=user.id,
                    label=item["address"][0],
                    street=item["address"][1],
                    details=item["address"][2],
                    is_default=True,
                )
                db.add(address)
            address.latitude = -34.5620 + (user.id * 0.001)
            address.longitude = -58.4550 - (user.id * 0.001)

        merchant_user = users_by_email["merchant@tupedido.example.com"]
        store = db.scalar(select(Store).where(Store.owner_user_id == merchant_user.id))
        if store is None:
            store = Store(
                owner_user_id=merchant_user.id,
                slug="almacen-belgrano",
                name="Almacen Belgrano",
                description="Despensa y kiosko de cercania con envios rapidos y retiro en local.",
                address="Amenabar 1234, Belgrano, CABA",
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
        store.latitude = -34.5627
        store.longitude = -58.4565

        desired_category_links = {
            categories_by_name["Despensa"].id: True,
            categories_by_name["Kiosko"].id: False,
        }
        existing_category_links = {
            link.category_id: link
            for link in db.scalars(select(StoreCategoryLink).where(StoreCategoryLink.store_id == store.id)).all()
        }
        for category_id, is_primary in desired_category_links.items():
            link = existing_category_links.get(category_id)
            if link is None:
                db.add(StoreCategoryLink(store_id=store.id, category_id=category_id, is_primary=is_primary))
            else:
                link.is_primary = is_primary

        if store.delivery_settings is None:
            db.add(
                StoreDeliverySettings(
                    store_id=store.id,
                    delivery_enabled=True,
                    pickup_enabled=True,
                    delivery_fee=3.5,
                    min_order=0,
                )
            )
        else:
            store.delivery_settings.delivery_enabled = True
            store.delivery_settings.pickup_enabled = True
            store.delivery_settings.delivery_fee = 3.5
            store.delivery_settings.min_order = 0

        if store.payment_settings is None:
            db.add(StorePaymentSettings(store_id=store.id, cash_enabled=True, mercadopago_enabled=True))
        else:
            store.payment_settings.cash_enabled = True
            store.payment_settings.mercadopago_enabled = True

        if store.mercadopago_credentials is None:
            db.add(
                MercadoPagoCredential(
                    store_id=store.id,
                    public_key="APP_USR-TEST-1234",
                    access_token_encrypted=encrypt_sensitive_value("TEST-ACCESS-TOKEN-1234"),
                    refresh_token_encrypted=encrypt_sensitive_value("TEST-REFRESH-TOKEN-1234"),
                    collector_id="123456789",
                    scope="offline_access payments write",
                    live_mode=False,
                    token_expires_at=datetime(2099, 1, 1, tzinfo=UTC),
                    oauth_connected_at=datetime.now(UTC),
                    is_configured=True,
                )
            )
        else:
            store.mercadopago_credentials.public_key = "APP_USR-TEST-1234"
            store.mercadopago_credentials.access_token_encrypted = encrypt_sensitive_value("TEST-ACCESS-TOKEN-1234")
            store.mercadopago_credentials.refresh_token_encrypted = encrypt_sensitive_value("TEST-REFRESH-TOKEN-1234")
            store.mercadopago_credentials.collector_id = "123456789"
            store.mercadopago_credentials.scope = "offline_access payments write"
            store.mercadopago_credentials.live_mode = False
            store.mercadopago_credentials.token_expires_at = datetime(2099, 1, 1, tzinfo=UTC)
            store.mercadopago_credentials.oauth_connected_at = datetime.now(UTC)
            store.mercadopago_credentials.reconnect_required = False
            store.mercadopago_credentials.is_configured = True

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
        zone.description = "Cobertura operativa inicial para Belgrano, Nunez y alrededores."
        zone.center_latitude = -34.5598
        zone.center_longitude = -58.4548
        zone.radius_km = 6
        zone.is_active = True
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
            rate = existing_zone_rates.get(vehicle_type)
            if rate is None:
                db.add(
                    DeliveryZoneRate(
                        zone_id=zone.id,
                        vehicle_type=vehicle_type,
                        delivery_fee_customer=values["delivery_fee_customer"],
                        rider_fee=values["rider_fee"],
                    )
                )
            else:
                rate.delivery_fee_customer = values["delivery_fee_customer"]
                rate.rider_fee = values["rider_fee"]

        if not store.hours:
            for day in range(7):
                db.add(
                    StoreHour(
                        store_id=store.id,
                        day_of_week=day,
                        opens_at=time(hour=0),
                        closes_at=time(hour=23, minute=59),
                        is_closed=False,
                    )
                )

        categories_seed = [
            ("Despensa", ["Promos", "Despensa", "Bebidas"]),
        ]
        for _, names in categories_seed:
            for index, name in enumerate(names):
                slug = slugify(name)
                product_category = db.scalar(
                    select(ProductCategory).where(ProductCategory.store_id == store.id, ProductCategory.slug == slug)
                )
                if product_category is None:
                    db.add(ProductCategory(store_id=store.id, name=name, slug=slug, sort_order=index))

        db.flush()
        product_categories = {
            item.slug: item
            for item in db.scalars(select(ProductCategory).where(ProductCategory.store_id == store.id)).all()
        }
        products_seed = [
            ("combo-ahorro", "Combo Ahorro", "Promo del dia con gaseosa y snack.", 8.9, None, "promos"),
            ("yerba-premium", "Yerba Premium 1kg", "Ideal para mate de todos los dias.", 6.4, None, "despensa"),
            ("gaseosa-cola", "Gaseosa Cola 1.5L", "Bebida fria lista para delivery.", 3.25, None, "bebidas"),
        ]
        for index, (_, name, description, price, compare_at, category_slug) in enumerate(products_seed):
            product = db.scalar(select(Product).where(Product.store_id == store.id, Product.name == name))
            if product is None:
                product = Product(
                    store_id=store.id,
                    product_category_id=product_categories[category_slug].id,
                    name=name,
                    description=description,
                    price=price,
                    compare_at_price=compare_at,
                    image_url=None,
                    is_available=True,
                    sort_order=index,
                )
                db.add(product)
            else:
                product.product_category_id = product_categories[category_slug].id
                product.description = description
                product.price = price
                product.compare_at_price = compare_at
                product.is_available = True
                product.sort_order = index

        applicant_user = users_by_email["applicant@tupedido.example.com"]
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

        rider_user = users_by_email["delivery@tupedido.example.com"]
        rider_application = db.scalar(select(DeliveryApplication).where(DeliveryApplication.user_id == rider_user.id))
        if rider_application is None:
            rider_application = DeliveryApplication(
                user_id=rider_user.id,
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
        rider_application.status = "approved"
        rider_profile = db.get(DeliveryProfile, rider_user.id)
        if rider_profile is None:
            rider_profile = DeliveryProfile(
                user_id=rider_user.id,
                application_id=rider_application.id,
                phone=rider_application.phone,
                vehicle_type="motorcycle",
                photo_url=None,
                dni_number=rider_application.dni_number,
                emergency_contact_name=rider_application.emergency_contact_name,
                emergency_contact_phone=rider_application.emergency_contact_phone,
                license_number=rider_application.license_number,
                vehicle_plate=rider_application.vehicle_plate,
                insurance_policy=rider_application.insurance_policy,
                availability="idle",
                is_active=True,
                current_zone_id=zone.id,
                current_latitude=-34.5615,
                current_longitude=-58.4555,
                push_enabled=False,
            )
            db.add(rider_profile)
        else:
            rider_profile.application_id = rider_application.id
            rider_profile.phone = rider_application.phone
            rider_profile.vehicle_type = "motorcycle"
            rider_profile.availability = "idle"
            rider_profile.is_active = True
            rider_profile.current_zone_id = zone.id
            rider_profile.current_latitude = -34.5615
            rider_profile.current_longitude = -58.4555
        rider_user.role = "delivery"

        db.commit()
    finally:
        db.close()
