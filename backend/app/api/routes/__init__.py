from fastapi import APIRouter

from app.api.routes import (
    addresses,
    admin,
    admin_delivery,
    admin_billing,
    auth,
    cart,
    catalog,
    checkout,
    delivery,
    delivery_applications,
    merchant,
    merchant_billing,
    merchant_applications,
    media,
    notifications,
    oauth,
    orders,
    payments,
    realtime,
)

router = APIRouter()
router.include_router(auth.router, prefix="/auth", tags=["auth"])
router.include_router(addresses.router, prefix="/addresses", tags=["addresses"])
router.include_router(catalog.router, prefix="/catalog", tags=["catalog"])
router.include_router(merchant_applications.router, prefix="/merchant-applications", tags=["merchant-applications"])
router.include_router(delivery_applications.router, prefix="/delivery-applications", tags=["delivery-applications"])
router.include_router(admin.router, prefix="/admin", tags=["admin"])
router.include_router(admin_delivery.router, prefix="/admin", tags=["admin"])
router.include_router(admin_billing.router, prefix="/admin", tags=["admin"])
router.include_router(merchant.router, prefix="/merchant", tags=["merchant"])
router.include_router(merchant_billing.router, prefix="/merchant", tags=["merchant"])
router.include_router(media.router, prefix="/media", tags=["media"])
router.include_router(delivery.router, prefix="/delivery", tags=["delivery"])
router.include_router(cart.router, prefix="/cart", tags=["cart"])
router.include_router(checkout.router, prefix="/checkout", tags=["checkout"])
router.include_router(oauth.router, prefix="/oauth", tags=["oauth"])
router.include_router(orders.router, prefix="/orders", tags=["orders"])
router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
router.include_router(payments.router, prefix="/payments", tags=["payments"])
router.include_router(realtime.router, tags=["realtime"])
