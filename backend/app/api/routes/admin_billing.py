from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import require_admin
from app.api.presenters import (
    serialize_admin_settlement_store,
    serialize_payment_provider,
    serialize_platform_settings,
    serialize_settlement_payment,
    serialize_transfer_notice,
)
from app.core.config import settings
from app.db.session import get_db
from app.models.delivery import RiderSettlementPayment
from app.models.platform import MerchantSettlementPayment, MerchantTransferNotice
from app.models.store import Store
from app.models.user import User
from app.schemas.admin import PaymentProviderRead, PaymentProviderUpdate
from app.schemas.settlement import (
    AdminSettlementPaymentCreate,
    AdminSettlementStoreRead,
    MerchantSettlementPaymentRead,
    MerchantTransferNoticeRead,
    MerchantTransferNoticeReviewUpdate,
    PlatformSettingsRead,
    PlatformSettingsUpdate,
    SettlementHistoryEntryRead,
)
from app.core.utils import encrypt_sensitive_value
from app.services.mercadopago import get_or_create_mercadopago_provider, provider_webhook_secret_configured
from app.services.media import normalize_media_url
from app.services.delivery import create_notifications
from app.services.platform import get_or_create_platform_settings, get_platform_settings_snapshot
from app.services.platform import DEFAULT_CATALOG_BANNER_HEIGHT, DEFAULT_CATALOG_BANNER_WIDTH
from app.services.settlements import (
    approve_notice_to_payment,
    apply_payment_to_oldest_charges,
    get_outstanding_balance,
    get_store_charges,
    get_store_notices,
    get_store_payments,
    get_store_rider_payments,
    reject_notice,
)

router = APIRouter()

NOTICE_OPTIONS = (
    selectinload(MerchantTransferNotice.store),
    selectinload(MerchantTransferNotice.settlement_payment).selectinload(MerchantSettlementPayment.allocations),
)

PAYMENT_OPTIONS = (
    selectinload(MerchantSettlementPayment.store),
    selectinload(MerchantSettlementPayment.notice),
    selectinload(MerchantSettlementPayment.allocations),
)

RIDER_PAYMENT_OPTIONS = (
    selectinload(RiderSettlementPayment.store),
    selectinload(RiderSettlementPayment.rider),
)


def _build_admin_settlement_history(db: Session) -> list[dict[str, object]]:
    notices = db.scalars(
        select(MerchantTransferNotice)
        .options(*NOTICE_OPTIONS)
        .order_by(MerchantTransferNotice.created_at.desc(), MerchantTransferNotice.id.desc())
    ).all()
    payments = db.scalars(
        select(MerchantSettlementPayment)
        .options(*PAYMENT_OPTIONS)
        .order_by(MerchantSettlementPayment.paid_at.desc(), MerchantSettlementPayment.id.desc())
    ).all()
    rider_payments = db.scalars(
        select(RiderSettlementPayment)
        .options(*RIDER_PAYMENT_OPTIONS)
        .order_by(RiderSettlementPayment.paid_at.desc(), RiderSettlementPayment.id.desc())
    ).all()

    entries: list[dict[str, object]] = []
    for notice in notices:
        entries.append(
            {
                "id": f"platform-notice-{notice.id}",
                "kind": "platform_notice",
                "store_id": notice.store_id,
                "store_name": notice.store.name if notice.store is not None else None,
                "rider_user_id": None,
                "rider_name": None,
                "title": "Aviso de transferencia recibido",
                "status": str(notice.status),
                "amount": float(notice.amount),
                "reference": notice.reference,
                "notes": notice.review_notes or notice.notes,
                "created_at": notice.created_at,
                "reviewed_at": notice.reviewed_at,
            }
        )
    for payment in payments:
        entries.append(
            {
                "id": f"platform-payment-{payment.id}",
                "kind": "platform_payment",
                "store_id": payment.store_id,
                "store_name": payment.store.name if payment.store is not None else None,
                "rider_user_id": None,
                "rider_name": None,
                "title": "Pago aplicado a cuenta corriente",
                "status": "applied",
                "amount": float(payment.amount),
                "reference": payment.reference,
                "notes": payment.notes,
                "created_at": payment.created_at,
                "reviewed_at": payment.paid_at,
            }
        )
    for payment in rider_payments:
        entries.append(
            {
                "id": f"rider-payment-{payment.id}",
                "kind": "rider_payment",
                "store_id": payment.store_id,
                "store_name": payment.store.name if payment.store is not None else None,
                "rider_user_id": payment.rider_user_id,
                "rider_name": payment.rider.full_name if payment.rider is not None else None,
                "title": "Pago a rider registrado",
                "status": str(payment.receiver_status or "pending_confirmation"),
                "amount": float(payment.amount),
                "reference": payment.reference,
                "notes": payment.receiver_response_notes or payment.notes,
                "created_at": payment.created_at,
                "reviewed_at": payment.receiver_responded_at or payment.paid_at,
            }
        )
    return sorted(
        entries,
        key=lambda entry: (
            entry["reviewed_at"] or entry["created_at"],
            entry["created_at"],
            entry["id"],
        ),
        reverse=True,
    )


@router.get("/platform-settings", response_model=PlatformSettingsRead)
def get_platform_settings(
    _: User = Depends(require_admin), db: Session = Depends(get_db)
) -> PlatformSettingsRead:
    return serialize_platform_settings(get_platform_settings_snapshot(db))


@router.put("/platform-settings", response_model=PlatformSettingsRead)
def update_platform_settings(
    payload: PlatformSettingsUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> PlatformSettingsRead:
    if payload.service_fee_amount < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Service fee amount cannot be negative",
        )
    settings = get_or_create_platform_settings(db)
    settings.service_fee_amount = payload.service_fee_amount
    if "catalog_banner_image_url" in payload.model_fields_set:
        settings.catalog_banner_image_url = normalize_media_url(payload.catalog_banner_image_url)
    if "platform_logo_url" in payload.model_fields_set:
        settings.platform_logo_url = normalize_media_url(payload.platform_logo_url)
    if "platform_wordmark_url" in payload.model_fields_set:
        settings.platform_wordmark_url = normalize_media_url(payload.platform_wordmark_url)
    if "platform_favicon_url" in payload.model_fields_set:
        settings.platform_favicon_url = normalize_media_url(payload.platform_favicon_url)
    if "platform_use_logo_as_favicon" in payload.model_fields_set and payload.platform_use_logo_as_favicon is not None:
        settings.platform_use_logo_as_favicon = payload.platform_use_logo_as_favicon
    if "catalog_banner_width" in payload.model_fields_set:
        settings.catalog_banner_width = payload.catalog_banner_width or DEFAULT_CATALOG_BANNER_WIDTH
    if "catalog_banner_height" in payload.model_fields_set:
        settings.catalog_banner_height = payload.catalog_banner_height or DEFAULT_CATALOG_BANNER_HEIGHT
    db.commit()
    db.refresh(settings)
    return serialize_platform_settings(settings)


@router.get("/payment-providers/mercadopago", response_model=PaymentProviderRead)
def get_mercadopago_payment_provider(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> PaymentProviderRead:
    provider = get_or_create_mercadopago_provider(db)
    return serialize_payment_provider(provider)


@router.post("/payment-providers/mercadopago", response_model=PaymentProviderRead)
def update_mercadopago_payment_provider(
    payload: PaymentProviderUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> PaymentProviderRead:
    provider = get_or_create_mercadopago_provider(db)
    provider.client_id = (payload.client_id or "").strip() or None
    provider.redirect_uri = (payload.redirect_uri or "").strip() or None
    provider.mode = payload.mode
    provider.enabled = payload.enabled
    if "client_secret" in payload.model_fields_set and (payload.client_secret or "").strip():
        provider.client_secret_encrypted = encrypt_sensitive_value(payload.client_secret.strip())
    if "webhook_secret" in payload.model_fields_set and (payload.webhook_secret or "").strip():
        provider.webhook_secret_encrypted = encrypt_sensitive_value(payload.webhook_secret.strip())

    if provider.enabled and (
        not provider.client_id or not provider.client_secret_encrypted or not provider.redirect_uri
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Client ID, Client Secret and Redirect URI are required when Mercado Pago is enabled",
        )
    if provider.enabled and not settings.mercadopago_simulated and not provider_webhook_secret_configured(provider):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Webhook Secret is required when Mercado Pago is enabled for real payments",
        )

    db.commit()
    db.refresh(provider)
    return serialize_payment_provider(provider)


@router.get("/settlements/stores", response_model=list[AdminSettlementStoreRead])
def list_settlement_stores(
    _: User = Depends(require_admin), db: Session = Depends(get_db)
) -> list[AdminSettlementStoreRead]:
    stores = db.scalars(
        select(Store)
        .options(selectinload(Store.owner))
        .order_by(Store.name.asc())
    ).all()
    results: list[AdminSettlementStoreRead] = []
    for store in stores:
        charges = get_store_charges(db, store.id)
        notices = get_store_notices(db, store.id)
        payments = get_store_payments(db, store.id)
        if not charges and not notices and not payments:
            continue
        results.append(
            serialize_admin_settlement_store(
                store=store,
                charges=charges,
                notices=notices,
                payments=payments,
            )
        )
    return results


@router.get("/settlements/notices", response_model=list[MerchantTransferNoticeRead])
def list_settlement_notices(
    _: User = Depends(require_admin), db: Session = Depends(get_db)
) -> list[MerchantTransferNoticeRead]:
    notices = db.scalars(
        select(MerchantTransferNotice)
        .options(*NOTICE_OPTIONS)
        .order_by(MerchantTransferNotice.created_at.desc(), MerchantTransferNotice.id.desc())
    ).all()
    return [serialize_transfer_notice(notice) for notice in notices]


@router.put("/settlements/notices/{notice_id}", response_model=MerchantTransferNoticeRead)
def review_settlement_notice(
    notice_id: int,
    payload: MerchantTransferNoticeReviewUpdate,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> MerchantTransferNoticeRead:
    notice = db.scalar(
        select(MerchantTransferNotice)
        .options(*NOTICE_OPTIONS)
        .where(MerchantTransferNotice.id == notice_id)
    )
    if notice is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transfer notice not found")
    if notice.status != "pending_review":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Transfer notice is already reviewed")

    notification_title = "Aviso de transferencia revisado"
    notification_body = "Tu aviso de transferencia fue revisado."
    notification_event_type = "merchant.transfer_notice_reviewed"
    try:
        if payload.status == "pending":
            notice.review_notes = payload.review_notes
        elif payload.status == "approved":
            outstanding_balance = get_outstanding_balance(db, notice.store_id)
            if float(notice.amount) > outstanding_balance:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Transfer amount exceeds outstanding store balance",
                )
            approve_notice_to_payment(
                db,
                notice,
                created_by_user_id=user.id,
                review_notes=payload.review_notes,
            )
            notification_title = "Liquidacion aprobada"
            notification_body = "El aviso de transferencia fue aprobado y aplicado."
            notification_event_type = "merchant.transfer_notice_approved"
        else:
            reject_notice(
                notice,
                reviewed_by_user_id=user.id,
                review_notes=payload.review_notes,
            )
            notification_title = "Liquidacion rechazada"
            notification_body = "El aviso de transferencia fue rechazado. Revisa las notas del admin."
            notification_event_type = "merchant.transfer_notice_rejected"
        if notice.store is not None and notice.store.owner_user_id is not None:
            create_notifications(
                db,
                user_ids=[notice.store.owner_user_id],
                order_id=None,
                event_type=notification_event_type,
                title=notification_title,
                body=notification_body,
                payload={"store_id": notice.store_id, "notice_id": notice.id, "status": payload.status},
            )
        db.commit()
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    db.refresh(notice)
    return serialize_transfer_notice(notice)


@router.get("/settlements/payments", response_model=list[MerchantSettlementPaymentRead])
def list_settlement_payments(
    _: User = Depends(require_admin), db: Session = Depends(get_db)
) -> list[MerchantSettlementPaymentRead]:
    payments = db.scalars(
        select(MerchantSettlementPayment)
        .options(*PAYMENT_OPTIONS)
        .order_by(MerchantSettlementPayment.paid_at.desc(), MerchantSettlementPayment.id.desc())
    ).all()
    return [serialize_settlement_payment(payment) for payment in payments]


@router.get("/settlements/history", response_model=list[SettlementHistoryEntryRead])
def list_settlement_history(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[SettlementHistoryEntryRead]:
    return [SettlementHistoryEntryRead(**item) for item in _build_admin_settlement_history(db)]


@router.post("/settlements/payments", response_model=MerchantSettlementPaymentRead, status_code=status.HTTP_201_CREATED)
def create_settlement_payment(
    payload: AdminSettlementPaymentCreate,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> MerchantSettlementPaymentRead:
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="Admin no registra pagos a plataforma. Los comercios cargan el comprobante y el admin solo audita o aprueba.",
    )
