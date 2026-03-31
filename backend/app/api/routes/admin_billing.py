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
from app.db.session import get_db
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
)
from app.core.utils import encrypt_sensitive_value
from app.services.mercadopago import get_or_create_mercadopago_provider
from app.services.platform import get_or_create_platform_settings
from app.services.platform import DEFAULT_CATALOG_BANNER_HEIGHT, DEFAULT_CATALOG_BANNER_WIDTH
from app.services.settlements import (
    approve_notice_to_payment,
    apply_payment_to_oldest_charges,
    get_outstanding_balance,
    get_store_charges,
    get_store_notices,
    get_store_payments,
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


@router.get("/platform-settings", response_model=PlatformSettingsRead)
def get_platform_settings(
    _: User = Depends(require_admin), db: Session = Depends(get_db)
) -> PlatformSettingsRead:
    return serialize_platform_settings(get_or_create_platform_settings(db))


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
        settings.catalog_banner_image_url = (payload.catalog_banner_image_url or "").strip() or None
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

    if provider.enabled and (
        not provider.client_id or not provider.client_secret_encrypted or not provider.redirect_uri
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Client ID, Client Secret and Redirect URI are required when Mercado Pago is enabled",
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
        else:
            reject_notice(
                notice,
                reviewed_by_user_id=user.id,
                review_notes=payload.review_notes,
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


@router.post("/settlements/payments", response_model=MerchantSettlementPaymentRead, status_code=status.HTTP_201_CREATED)
def create_settlement_payment(
    payload: AdminSettlementPaymentCreate,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> MerchantSettlementPaymentRead:
    if payload.amount <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Amount must be greater than zero")
    store = db.scalar(select(Store).where(Store.id == payload.store_id))
    if store is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")
    outstanding_balance = get_outstanding_balance(db, payload.store_id)
    if payload.amount > outstanding_balance:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment amount exceeds outstanding store balance",
        )
    payment = MerchantSettlementPayment(
        store_id=payload.store_id,
        source="admin_manual",
        amount=payload.amount,
        paid_at=payload.paid_at or datetime.now(UTC),
        reference=payload.reference,
        notes=payload.notes,
        created_by_user_id=user.id,
    )
    db.add(payment)
    db.flush()
    remaining = apply_payment_to_oldest_charges(db, payment)
    if remaining > 0:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment amount exceeds outstanding store balance",
        )
    db.commit()
    payment = db.scalar(
        select(MerchantSettlementPayment)
        .options(*PAYMENT_OPTIONS)
        .where(MerchantSettlementPayment.id == payment.id)
    )
    if payment is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Payment was not persisted")
    return serialize_settlement_payment(payment)
