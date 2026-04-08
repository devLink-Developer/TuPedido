from __future__ import annotations

from sqlalchemy import inspect as sa_inspect
from sqlalchemy.orm.attributes import NO_VALUE

from app.core.utils import is_store_open, mask_secret
from app.schemas.admin import PaymentProviderRead
from app.schemas.cart import CartItemRead, CartRead
from app.schemas.catalog import (
    CatalogBannerRead,
    CategoryRead,
    MerchantApplicationRead,
    PlatformBrandingRead,
    ProductCategoryRead,
    ProductSubcategoryRead,
    ProductRead,
    StoreDeliverySettingsRead,
    StoreDetailRead,
    StoreHourRead,
    StorePaymentSettingsRead,
    StoreSummaryRead,
)
from app.schemas.delivery import (
    DeliveryApplicationRead,
    DeliveryProfileRead,
    DeliveryZoneRead,
    NotificationRead,
)
from app.schemas.order import OrderItemRead, OrderRead, OrderTrackingRead
from app.schemas.settlement import (
    AdminSettlementStoreRead,
    MerchantServiceFeeChargeRead,
    MerchantSettlementOverviewRead,
    MerchantSettlementPaymentRead,
    MerchantTransferNoticeRead,
    PlatformSettingsRead,
    RiderSettlementPaymentRead,
    SettlementAllocationRead,
)
from app.schemas.promotion import AppliedPromotionSummaryRead, PromotionItemRead, PromotionRead
from app.services.category_colors import resolve_category_palette
from app.services.mercadopago import (
    get_store_payment_account,
    is_store_mercadopago_ready,
    mercadopago_connection_status,
)
from app.services.promotions import deserialize_items_snapshot
from app.services.platform import DEFAULT_CATALOG_BANNER_HEIGHT, DEFAULT_CATALOG_BANNER_WIDTH
from app.services.product_pricing import serialize_product_pricing
from app.services.store_address import store_delivery_is_enabled
from app.services.settlements import (
    charge_outstanding_amount,
    charge_paid_amount,
    charge_status,
    payment_applied_amount,
)
from app.services.order_runtime import has_order_promotion_schema


def serialize_category(category: object) -> CategoryRead:
    color, color_light = resolve_category_palette(
        getattr(category, "color", None),
        getattr(category, "color_light", None),
    )
    return CategoryRead(
        id=category.id,
        name=category.name,
        slug=category.slug,
        description=getattr(category, "description", None),
        color=color,
        color_light=color_light,
        icon=getattr(category, "icon", None),
        is_active=bool(getattr(category, "is_active", True)),
        sort_order=int(getattr(category, "sort_order", 0) or 0),
    )


def serialize_store_delivery_settings(store: object) -> StoreDeliverySettingsRead:
    settings = getattr(store, "delivery_settings", None)
    return StoreDeliverySettingsRead(
        delivery_enabled=store_delivery_is_enabled(store),
        pickup_enabled=bool(settings.pickup_enabled) if settings else False,
        delivery_fee=float(settings.delivery_fee) if settings else 0,
        free_delivery_min_order=float(settings.free_delivery_min_order)
        if settings and getattr(settings, "free_delivery_min_order", None) is not None
        else None,
        rider_fee=float(getattr(settings, "rider_fee", 0) or 0) if settings else 0,
        min_order=float(settings.min_order) if settings else 0,
    )


def serialize_store_payment_settings(
    store: object, *, mercadopago_provider: object | None = None
) -> StorePaymentSettingsRead:
    settings = getattr(store, "payment_settings", None)
    account = get_store_payment_account(store)
    public_key = account.public_key if account else None
    connection_status = mercadopago_connection_status(store)
    return StorePaymentSettingsRead(
        cash_enabled=bool(settings.cash_enabled) if settings else False,
        mercadopago_enabled=bool(settings.mercadopago_enabled) if settings else False,
        mercadopago_configured=is_store_mercadopago_ready(store, provider=mercadopago_provider),
        mercadopago_provider_enabled=bool(getattr(mercadopago_provider, "enabled", False)),
        mercadopago_provider_mode=str(getattr(mercadopago_provider, "mode", "sandbox") or "sandbox"),
        mercadopago_public_key_masked=mask_secret(public_key) if public_key else None,
        mercadopago_connection_status=connection_status,
        mercadopago_reconnect_required=connection_status == "reconnect_required",
        mercadopago_onboarding_completed=bool(getattr(account, "onboarding_completed", False)),
        mercadopago_oauth_connected_at=getattr(account, "updated_at", None)
        if account and bool(getattr(account, "connected", False))
        else None,
        mercadopago_mp_user_id=getattr(account, "mp_user_id", None) if account else None,
    )


def _category_metadata(store: object) -> tuple[int | None, str | None, str | None, list[str]]:
    links = list(getattr(store, "category_links", []) or [])
    links = sorted(links, key=lambda link: (not link.is_primary, link.category.name.lower()))
    categories = [link.category.name for link in links]
    primary_link = next((link for link in links if link.is_primary), None) or (links[0] if links else None)
    if primary_link is None:
        return None, None, None, categories
    return primary_link.category_id, primary_link.category.name, primary_link.category.slug, categories


def serialize_product_category(product_category: object) -> ProductCategoryRead:
    return ProductCategoryRead(
        id=product_category.id,
        name=product_category.name,
        slug=product_category.slug,
        sort_order=product_category.sort_order,
        subcategories=[
            ProductSubcategoryRead(
                id=subcategory.id,
                product_category_id=subcategory.product_category_id,
                name=subcategory.name,
                slug=subcategory.slug,
                sort_order=subcategory.sort_order,
            )
            for subcategory in getattr(product_category, "subcategories", []) or []
        ],
    )


def serialize_product(product: object) -> ProductRead:
    pricing = serialize_product_pricing(
        price=float(product.price),
        commercial_discount_type=getattr(product, "commercial_discount_type", None),
        commercial_discount_value=float(product.commercial_discount_value)
        if getattr(product, "commercial_discount_value", None) is not None
        else None,
    )
    return ProductRead(
        id=product.id,
        store_id=product.store_id,
        product_category_id=product.product_category_id,
        product_category_name=product.product_category.name if product.product_category else None,
        product_subcategory_id=getattr(product, "product_subcategory_id", None),
        product_subcategory_name=product.product_subcategory.name if getattr(product, "product_subcategory", None) else None,
        sku=product.sku or f"PRD-{product.id}",
        name=product.name,
        brand=getattr(product, "brand", None),
        barcode=getattr(product, "barcode", None),
        unit_label=getattr(product, "unit_label", None),
        description=product.description,
        price=float(product.price),
        compare_at_price=float(product.compare_at_price) if product.compare_at_price is not None else None,
        final_price=float(pricing["final_price"]),
        commercial_discount_type=pricing["commercial_discount_type"],
        commercial_discount_value=float(pricing["commercial_discount_value"])
        if pricing["commercial_discount_value"] is not None
        else None,
        commercial_discount_amount=float(pricing["commercial_discount_amount"]),
        commercial_discount_percentage=float(pricing["commercial_discount_percentage"]),
        has_commercial_discount=bool(pricing["has_commercial_discount"]),
        image_url=product.image_url,
        stock_quantity=getattr(product, "stock_quantity", None),
        max_per_order=getattr(product, "max_per_order", None),
        is_available=product.is_available,
        sort_order=product.sort_order,
    )


def serialize_applied_promotion(application: object) -> AppliedPromotionSummaryRead:
    items = getattr(application, "items", None)
    if items is None:
        items = deserialize_items_snapshot(getattr(application, "items_snapshot_json", None))
    return AppliedPromotionSummaryRead(
        promotion_id=getattr(application, "promotion_id", None),
        promotion_name=getattr(application, "promotion_name", getattr(application, "promotion_name_snapshot", "Promocion")),
        combo_count=int(getattr(application, "combo_count", 0) or 0),
        sale_price=float(getattr(application, "sale_price", getattr(application, "sale_price_snapshot", 0)) or 0),
        base_total=float(getattr(application, "base_total", getattr(application, "base_total_snapshot", 0)) or 0),
        discount_total=float(getattr(application, "discount_total", getattr(application, "discount_total_snapshot", 0)) or 0),
        items=[
            PromotionItemRead(
                id=int(item.get("id") or 0),
                product_id=int(item.get("product_id") or 0),
                product_name=str(item.get("product_name") or f"Producto #{item.get('product_id')}"),
                quantity=int(item.get("quantity") or 0),
                sort_order=int(item.get("sort_order") or 0),
            )
            for item in items
        ],
    )


def serialize_promotion(promotion: object) -> PromotionRead:
    return PromotionRead(
        id=promotion.id,
        store_id=promotion.store_id,
        name=promotion.name,
        description=getattr(promotion, "description", None),
        sale_price=float(promotion.sale_price),
        max_per_customer_per_day=int(getattr(promotion, "max_per_customer_per_day", 1) or 1),
        is_active=bool(getattr(promotion, "is_active", True)),
        sort_order=int(getattr(promotion, "sort_order", 0) or 0),
        created_at=promotion.created_at,
        updated_at=promotion.updated_at,
        items=[
            PromotionItemRead(
                id=item.id,
                product_id=item.product_id,
                product_name=item.product.name if getattr(item, "product", None) is not None else f"Producto #{item.product_id}",
                quantity=int(item.quantity),
                sort_order=int(getattr(item, "sort_order", 0) or 0),
            )
            for item in getattr(promotion, "items", []) or []
        ],
    )


def serialize_store_summary(
    store: object, *, mercadopago_provider: object | None = None
) -> StoreSummaryRead:
    primary_category_id, primary_category, primary_category_slug, categories = _category_metadata(store)
    category_ids = [link.category_id for link in getattr(store, "category_links", []) or []]
    return StoreSummaryRead(
        id=store.id,
        slug=store.slug,
        name=store.name,
        description=store.description,
        address=store.address,
        postal_code=getattr(store, "postal_code", None),
        province=getattr(store, "province", None),
        locality=getattr(store, "locality", None),
        phone=store.phone,
        latitude=float(store.latitude) if getattr(store, "latitude", None) is not None else None,
        longitude=float(store.longitude) if getattr(store, "longitude", None) is not None else None,
        logo_url=store.logo_url,
        cover_image_url=store.cover_image_url,
        status=store.status,
        accepting_orders=store.accepting_orders,
        is_open=is_store_open(store),
        opening_note=store.opening_note,
        min_delivery_minutes=store.min_delivery_minutes,
        max_delivery_minutes=store.max_delivery_minutes,
        rating=float(store.rating),
        rating_count=store.rating_count,
        category_ids=category_ids,
        primary_category_id=primary_category_id,
        primary_category=primary_category,
        primary_category_slug=primary_category_slug,
        categories=categories,
        delivery_settings=serialize_store_delivery_settings(store),
        payment_settings=serialize_store_payment_settings(store, mercadopago_provider=mercadopago_provider),
    )


def serialize_store_detail(
    store: object, *, mercadopago_provider: object | None = None
) -> StoreDetailRead:
    summary = serialize_store_summary(store, mercadopago_provider=mercadopago_provider)
    return StoreDetailRead(
        **summary.model_dump(),
        product_categories=[serialize_product_category(item) for item in store.product_categories],
        products=[serialize_product(item) for item in store.products],
        hours=[
            StoreHourRead(
                day_of_week=hour.day_of_week,
                opens_at=hour.opens_at,
                closes_at=hour.closes_at,
                is_closed=hour.is_closed,
            )
            for hour in store.hours
        ],
    )


def serialize_application(application: object) -> MerchantApplicationRead:
    return MerchantApplicationRead(
        id=application.id,
        business_name=application.business_name,
        description=application.description,
        address=application.address,
        phone=application.phone,
        logo_url=application.logo_url,
        cover_image_url=application.cover_image_url,
        requested_category_ids=list(application.requested_category_ids or []),
        requested_category_names=[
            category.name
            for category in getattr(application, "requested_categories", []) or []
        ],
        status=application.status,
        review_notes=application.review_notes,
        created_at=application.created_at,
        updated_at=application.updated_at,
        linked_store_slug=application.store.slug if application.store else None,
    )


def serialize_cart(cart: object) -> CartRead:
    return CartRead(
        id=cart.id,
        store_id=cart.store_id,
        store_name=cart.store.name if cart.store else None,
        store_slug=cart.store.slug if cart.store else None,
        delivery_mode=cart.delivery_mode,
        delivery_settings=serialize_store_delivery_settings(cart.store)
        if cart.store
        else StoreDeliverySettingsRead(
            delivery_enabled=False,
            pickup_enabled=False,
            delivery_fee=0,
            free_delivery_min_order=None,
            rider_fee=0,
            min_order=0,
        ),
        subtotal=float(cart.subtotal),
        commercial_discount_total=float(getattr(cart, "commercial_discount_total", 0) or 0),
        financial_discount_total=float(getattr(cart, "financial_discount_total", 0) or 0),
        delivery_fee=float(cart.delivery_fee),
        service_fee=float(cart.service_fee),
        total=float(cart.total),
        pricing={
            "subtotal": float(cart.subtotal),
            "commercial_discount_total": float(getattr(cart, "commercial_discount_total", 0) or 0),
            "financial_discount_total": float(getattr(cart, "financial_discount_total", 0) or 0),
            "delivery_fee": float(cart.delivery_fee),
            "service_fee": float(cart.service_fee),
            "total": float(cart.total),
        },
        items=[
            CartItemRead(
                id=item.id,
                product_id=item.product_id,
                product_name=item.product_name_snapshot,
                base_unit_price=float(getattr(item, "base_unit_price_snapshot", item.unit_price_snapshot)),
                unit_price=float(item.unit_price_snapshot),
                commercial_discount_amount=float(getattr(item, "commercial_discount_amount_snapshot", 0) or 0),
                quantity=item.quantity,
                note=item.note,
            )
            for item in cart.items
        ],
        applied_promotions=[
            serialize_applied_promotion(application)
            for application in getattr(cart, "applied_promotions", []) or []
        ],
    )


def _promotion_applications_for_serialization(order: object) -> list[object]:
    state = sa_inspect(order)
    attr_state = state.attrs.promotion_applications
    loaded_value = attr_state.loaded_value
    if loaded_value is not NO_VALUE:
        return list(loaded_value or [])
    if state.session is None or not has_order_promotion_schema(state.session):
        return []
    return list(getattr(order, "promotion_applications", []) or [])


def serialize_order(order: object) -> OrderRead:
    return OrderRead(
        id=order.id,
        store_id=order.store_id,
        store_name=order.store_name_snapshot,
        store_slug=order.store_slug_snapshot,
        customer_name=order.customer_name_snapshot,
        delivery_mode=order.delivery_mode,
        payment_method=order.payment_method,
        payment_status=order.payment_status,
        payment_reference=order.payment_reference,
        status=order.status,
        address_label=order.address_label_snapshot,
        address_full=order.address_full_snapshot,
        store_latitude=float(order.store.latitude) if getattr(order, "store", None) and order.store.latitude is not None else None,
        store_longitude=float(order.store.longitude) if getattr(order, "store", None) and order.store.longitude is not None else None,
        address_latitude=float(order.address.latitude) if getattr(order, "address", None) and order.address.latitude is not None else None,
        address_longitude=float(order.address.longitude) if getattr(order, "address", None) and order.address.longitude is not None else None,
        subtotal=float(order.subtotal),
        commercial_discount_total=float(getattr(order, "commercial_discount_total", 0) or 0),
        financial_discount_total=float(getattr(order, "financial_discount_total", 0) or 0),
        delivery_fee=float(order.delivery_fee),
        service_fee=float(order.service_fee),
        delivery_fee_customer=float(getattr(order, "delivery_fee_customer", 0) or 0),
        rider_fee=float(getattr(order, "rider_fee", 0) or 0),
        total=float(order.total),
        delivery_status=getattr(order, "delivery_status", "unassigned"),
        delivery_provider=getattr(order, "delivery_provider", "store"),
        delivery_zone_id=getattr(order, "delivery_zone_id", None),
        assigned_rider_id=getattr(order, "assigned_rider_id", None),
        assigned_rider_name=getattr(order, "assigned_rider_name_snapshot", None),
        assigned_rider_phone_masked=getattr(order, "assigned_rider_phone_masked", None),
        assigned_rider_vehicle_type=getattr(order, "assigned_rider_vehicle_type", None),
        tracking_last_latitude=float(order.tracking_last_latitude)
        if getattr(order, "tracking_last_latitude", None) is not None
        else None,
        tracking_last_longitude=float(order.tracking_last_longitude)
        if getattr(order, "tracking_last_longitude", None) is not None
        else None,
        tracking_last_at=getattr(order, "tracking_last_at", None),
        tracking_stale=bool(getattr(order, "tracking_stale", False)),
        eta_minutes=getattr(order, "eta_minutes", None),
        otp_required=bool(getattr(order, "otp_required", False)),
        merchant_ready_at=getattr(order, "merchant_ready_at", None),
        out_for_delivery_at=getattr(order, "out_for_delivery_at", None),
        delivered_at=getattr(order, "delivered_at", None),
        updated_at=getattr(order, "updated_at", None),
        created_at=order.created_at,
        items=[
            OrderItemRead(
                id=item.id,
                product_id=item.product_id,
                product_name=item.product_name_snapshot,
                base_unit_price=float(getattr(item, "base_unit_price_snapshot", item.unit_price_snapshot)),
                quantity=item.quantity,
                unit_price=float(item.unit_price_snapshot),
                commercial_discount_amount=float(getattr(item, "commercial_discount_amount_snapshot", 0) or 0),
                note=item.note,
            )
            for item in order.items
        ],
        pricing={
            "subtotal": float(order.subtotal),
            "commercial_discount_total": float(getattr(order, "commercial_discount_total", 0) or 0),
            "financial_discount_total": float(getattr(order, "financial_discount_total", 0) or 0),
            "delivery_fee": float(getattr(order, "delivery_fee_customer", order.delivery_fee) or 0),
            "service_fee": float(order.service_fee),
            "total": float(order.total),
        },
        applied_promotions=[
            serialize_applied_promotion(application)
            for application in _promotion_applications_for_serialization(order)
        ],
    )


def serialize_tracking(order: object) -> OrderTrackingRead:
    delivery_status = getattr(order, "delivery_status", "unassigned")
    otp_code = getattr(order, "otp_code", None) if getattr(order, "assigned_rider_id", None) is not None else None
    return OrderTrackingRead(
        order_id=order.id,
        status=order.status,
        delivery_status=delivery_status,
        delivery_provider=getattr(order, "delivery_provider", "store"),
        tracking_enabled=delivery_status in {"assigned", "heading_to_store", "picked_up", "near_customer", "delivered"},
        assigned_rider_id=getattr(order, "assigned_rider_id", None),
        assigned_rider_name=getattr(order, "assigned_rider_name_snapshot", None),
        assigned_rider_phone_masked=getattr(order, "assigned_rider_phone_masked", None),
        assigned_rider_vehicle_type=getattr(order, "assigned_rider_vehicle_type", None),
        store_latitude=float(order.store.latitude) if getattr(order, "store", None) and order.store.latitude is not None else None,
        store_longitude=float(order.store.longitude) if getattr(order, "store", None) and order.store.longitude is not None else None,
        address_latitude=float(order.address.latitude) if getattr(order, "address", None) and order.address.latitude is not None else None,
        address_longitude=float(order.address.longitude) if getattr(order, "address", None) and order.address.longitude is not None else None,
        tracking_last_latitude=float(order.tracking_last_latitude)
        if getattr(order, "tracking_last_latitude", None) is not None
        else None,
        tracking_last_longitude=float(order.tracking_last_longitude)
        if getattr(order, "tracking_last_longitude", None) is not None
        else None,
        tracking_last_at=getattr(order, "tracking_last_at", None),
        tracking_stale=bool(getattr(order, "tracking_stale", False)),
        eta_minutes=getattr(order, "eta_minutes", None),
        otp_required=bool(getattr(order, "otp_required", False)),
        otp_code=otp_code,
    )


def serialize_delivery_application(application: object) -> DeliveryApplicationRead:
    return DeliveryApplicationRead(
        id=application.id,
        user_id=application.user_id,
        store_id=getattr(application, "store_id", None),
        store_name=application.store.name if getattr(application, "store", None) else None,
        user_name=application.user.full_name,
        user_email=application.user.email,
        phone=application.phone,
        vehicle_type=application.vehicle_type,
        photo_url=application.photo_url,
        dni_number=application.dni_number,
        emergency_contact_name=application.emergency_contact_name,
        emergency_contact_phone=application.emergency_contact_phone,
        license_number=application.license_number,
        vehicle_plate=application.vehicle_plate,
        insurance_policy=application.insurance_policy,
        notes=application.notes,
        status=application.status,
        review_notes=application.review_notes,
        reviewed_at=application.reviewed_at,
        created_at=application.created_at,
        updated_at=application.updated_at,
    )


def serialize_delivery_profile(profile: object) -> DeliveryProfileRead:
    return DeliveryProfileRead(
        user_id=profile.user_id,
        store_id=getattr(profile, "store_id", None),
        store_name=profile.store.name if getattr(profile, "store", None) else None,
        full_name=profile.user.full_name,
        email=profile.user.email,
        phone=profile.phone,
        vehicle_type=profile.vehicle_type,
        photo_url=getattr(profile, "photo_url", None),
        dni_number=profile.dni_number,
        emergency_contact_name=profile.emergency_contact_name,
        emergency_contact_phone=profile.emergency_contact_phone,
        license_number=getattr(profile, "license_number", None),
        vehicle_plate=getattr(profile, "vehicle_plate", None),
        insurance_policy=getattr(profile, "insurance_policy", None),
        notes=getattr(getattr(profile, "application", None), "notes", None),
        availability=profile.availability,
        is_active=profile.is_active,
        current_zone_id=profile.current_zone_id,
        current_latitude=float(profile.current_latitude) if profile.current_latitude is not None else None,
        current_longitude=float(profile.current_longitude) if profile.current_longitude is not None else None,
        last_location_at=profile.last_location_at,
        completed_deliveries=profile.completed_deliveries,
        rating=float(profile.rating),
        push_enabled=profile.push_enabled,
    )


def serialize_delivery_zone(zone: object) -> DeliveryZoneRead:
    return DeliveryZoneRead(
        id=zone.id,
        name=zone.name,
        description=zone.description,
        center_latitude=float(zone.center_latitude),
        center_longitude=float(zone.center_longitude),
        radius_km=float(zone.radius_km),
        is_active=zone.is_active,
        rates=[
            {
                "vehicle_type": rate.vehicle_type,
                "delivery_fee_customer": float(rate.delivery_fee_customer),
                "rider_fee": float(rate.rider_fee),
            }
            for rate in zone.rates
        ],
    )


def serialize_notification(notification: object) -> NotificationRead:
    return NotificationRead(
        id=notification.id,
        order_id=notification.order_id,
        channel=notification.channel,
        event_type=notification.event_type,
        title=notification.title,
        body=notification.body,
        payload_json=notification.payload_json,
        is_read=notification.is_read,
        push_status=notification.push_status,
        created_at=notification.created_at,
    )


def serialize_rider_settlement_payment(payment: object) -> RiderSettlementPaymentRead:
    rider = getattr(payment, "rider", None)
    store = getattr(payment, "store", None)
    return RiderSettlementPaymentRead(
        id=payment.id,
        rider_user_id=payment.rider_user_id,
        rider_name=getattr(rider, "full_name", None),
        store_id=getattr(payment, "store_id", None),
        store_name=getattr(store, "name", None),
        source=str(getattr(payment, "source", "merchant_manual") or "merchant_manual"),
        amount=float(payment.amount),
        paid_at=payment.paid_at,
        reference=getattr(payment, "reference", None),
        notes=getattr(payment, "notes", None),
        receiver_status=str(getattr(payment, "receiver_status", "pending_confirmation") or "pending_confirmation"),
        receiver_response_notes=getattr(payment, "receiver_response_notes", None),
        receiver_responded_at=getattr(payment, "receiver_responded_at", None),
        created_at=payment.created_at,
    )


def serialize_platform_settings(settings: object) -> PlatformSettingsRead:
    logo_url = getattr(settings, "platform_logo_url", None)
    wordmark_url = getattr(settings, "platform_wordmark_url", None)
    favicon_url = getattr(settings, "platform_favicon_url", None)
    use_logo_as_favicon = bool(getattr(settings, "platform_use_logo_as_favicon", False))
    resolved_favicon_url = logo_url if use_logo_as_favicon and logo_url else favicon_url
    return PlatformSettingsRead(
        service_fee_amount=float(settings.service_fee_amount),
        platform_logo_url=logo_url,
        platform_wordmark_url=wordmark_url,
        platform_favicon_url=favicon_url,
        platform_use_logo_as_favicon=use_logo_as_favicon,
        resolved_favicon_url=resolved_favicon_url,
        catalog_banner_image_url=getattr(settings, "catalog_banner_image_url", None),
        catalog_banner_width=getattr(settings, "catalog_banner_width", DEFAULT_CATALOG_BANNER_WIDTH),
        catalog_banner_height=getattr(settings, "catalog_banner_height", DEFAULT_CATALOG_BANNER_HEIGHT),
        updated_at=getattr(settings, "updated_at", None),
        updated_by=None,
    )


def serialize_payment_provider(provider: object) -> PaymentProviderRead:
    return PaymentProviderRead(
        provider=getattr(provider, "provider", "mercadopago"),
        client_id=getattr(provider, "client_id", None),
        client_secret_masked="********" if getattr(provider, "client_secret_encrypted", None) else None,
        redirect_uri=getattr(provider, "redirect_uri", None),
        enabled=bool(getattr(provider, "enabled", False)),
        mode=str(getattr(provider, "mode", "sandbox") or "sandbox"),
        updated_at=getattr(provider, "updated_at", None),
    )


def serialize_catalog_banner(settings: object) -> CatalogBannerRead:
    return CatalogBannerRead(
        catalog_banner_image_url=getattr(settings, "catalog_banner_image_url", None),
        catalog_banner_width=getattr(settings, "catalog_banner_width", DEFAULT_CATALOG_BANNER_WIDTH),
        catalog_banner_height=getattr(settings, "catalog_banner_height", DEFAULT_CATALOG_BANNER_HEIGHT),
    )


def serialize_platform_branding(settings: object) -> PlatformBrandingRead:
    logo_url = getattr(settings, "platform_logo_url", None)
    wordmark_url = getattr(settings, "platform_wordmark_url", None)
    favicon_url = getattr(settings, "platform_favicon_url", None)
    use_logo_as_favicon = bool(getattr(settings, "platform_use_logo_as_favicon", False))
    return PlatformBrandingRead(
        platform_logo_url=logo_url,
        platform_wordmark_url=wordmark_url,
        platform_favicon_url=favicon_url,
        platform_use_logo_as_favicon=use_logo_as_favicon,
        resolved_favicon_url=logo_url if use_logo_as_favicon and logo_url else favicon_url,
    )


def serialize_settlement_payment(payment: object) -> MerchantSettlementPaymentRead:
    return MerchantSettlementPaymentRead(
        id=payment.id,
        store_id=payment.store_id,
        store_name=payment.store.name if getattr(payment, "store", None) else None,
        store_slug=payment.store.slug if getattr(payment, "store", None) else None,
        notice_id=payment.notice_id,
        source=payment.source,
        method=payment.source,
        amount=float(payment.amount),
        applied_amount=payment_applied_amount(payment),
        paid_at=payment.paid_at,
        reference=payment.reference,
        notes=payment.notes,
        created_at=payment.created_at,
        allocations=[
            SettlementAllocationRead(
                charge_id=allocation.charge_id,
                order_id=allocation.charge.order_id,
                amount=float(allocation.amount),
            )
            for allocation in payment.allocations
        ],
    )


def serialize_settlement_charge(charge: object) -> MerchantServiceFeeChargeRead:
    order = charge.order
    settled_at = max(
        (
            getattr(allocation.payment, "paid_at", None)
            for allocation in charge.allocations
            if getattr(allocation, "payment", None) is not None
        ),
        default=None,
    )
    return MerchantServiceFeeChargeRead(
        id=charge.id,
        store_id=charge.store_id,
        order_id=charge.order_id,
        order_status=order.status,
        payment_method=order.payment_method,
        delivery_mode=order.delivery_mode,
        customer_name=order.customer_name_snapshot,
        order_total=float(order.total),
        amount=float(charge.amount),
        service_fee=float(charge.amount),
        allocated_amount=charge_paid_amount(charge),
        outstanding_amount=charge_outstanding_amount(charge),
        status=charge_status(charge),
        created_at=charge.created_at,
        order_created_at=order.created_at,
        settled_at=settled_at,
    )


def serialize_transfer_notice(notice: object) -> MerchantTransferNoticeRead:
    return MerchantTransferNoticeRead(
        id=notice.id,
        store_id=notice.store_id,
        store_name=notice.store.name if getattr(notice, "store", None) else None,
        store_slug=notice.store.slug if getattr(notice, "store", None) else None,
        amount=float(notice.amount),
        transfer_date=notice.transfer_date,
        bank=notice.bank,
        reference=notice.reference,
        notes=notice.notes,
        proof_url=getattr(notice, "proof_url", None),
        proof_content_type=getattr(notice, "proof_content_type", None),
        proof_original_name=getattr(notice, "proof_original_name", None),
        status=notice.status,
        review_notes=notice.review_notes,
        reviewed_notes=notice.review_notes,
        created_at=notice.created_at,
        reviewed_at=notice.reviewed_at,
        settlement_payment_id=notice.settlement_payment.id if notice.settlement_payment else None,
    )


def serialize_settlement_overview(
    *,
    store: object,
    service_fee_amount: float,
    charges: list[object],
    notices: list[object],
    payments: list[object],
) -> MerchantSettlementOverviewRead:
    last_charge_at = max((charge.created_at for charge in charges), default=None)
    last_payment_at = max((payment.paid_at for payment in payments), default=None)
    paid_total = sum(float(payment.amount) for payment in payments)
    open_charges_count = sum(1 for charge in charges if charge_outstanding_amount(charge) > 0)
    return MerchantSettlementOverviewRead(
        store_id=store.id,
        store_name=store.name,
        store_slug=store.slug,
        service_fee_amount=service_fee_amount,
        pending_balance=sum(charge_outstanding_amount(charge) for charge in charges),
        open_charges_count=open_charges_count,
        pending_charges_count=open_charges_count,
        pending_notices_count=sum(1 for notice in notices if notice.status == "pending_review"),
        charged_total=sum(float(charge.amount) for charge in charges),
        paid_total=paid_total,
        paid_balance=paid_total,
        last_charge_at=last_charge_at,
        last_payment_at=last_payment_at,
        payments=[serialize_settlement_payment(payment) for payment in payments],
    )


def serialize_admin_settlement_store(
    *,
    store: object,
    charges: list[object],
    notices: list[object],
    payments: list[object],
) -> AdminSettlementStoreRead:
    last_charge_at = max((charge.created_at for charge in charges), default=None)
    last_payment_at = max((payment.paid_at for payment in payments), default=None)
    last_notice_at = max((notice.created_at for notice in notices), default=None)
    last_activity_at = max(
        (value for value in (last_charge_at, last_payment_at, last_notice_at) if value is not None),
        default=None,
    )
    open_charges_count = sum(1 for charge in charges if charge_outstanding_amount(charge) > 0)
    return AdminSettlementStoreRead(
        id=store.id,
        store_id=store.id,
        store_name=store.name,
        store_slug=store.slug,
        owner_name=getattr(getattr(store, "owner", None), "full_name", None)
        or getattr(getattr(store, "owner", None), "email", None)
        or "Sin owner",
        pending_balance=sum(charge_outstanding_amount(charge) for charge in charges),
        open_charges_count=open_charges_count,
        pending_charges_count=open_charges_count,
        pending_notices_count=sum(1 for notice in notices if notice.status == "pending_review"),
        charged_total=sum(float(charge.amount) for charge in charges),
        paid_total=sum(float(payment.amount) for payment in payments),
        last_charge_at=last_charge_at,
        last_activity_at=last_activity_at,
        status=getattr(store, "status", None),
    )
