from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.api.deps import require_merchant
from app.api.presenters import (
    serialize_settlement_charge,
    serialize_settlement_overview,
    serialize_transfer_notice,
)
from app.db.session import get_db
from app.models.platform import MerchantTransferNotice
from app.models.store import Store, StoreCategoryLink
from app.models.user import User
from app.schemas.merchant import MercadoPagoConnectUrlRead
from app.schemas.settlement import (
    MerchantServiceFeeChargeRead,
    MerchantSettlementOverviewRead,
    MerchantTransferNoticeCreate,
    MerchantTransferNoticeRead,
)
from app.services.mercadopago import (
    get_or_create_mercadopago_provider,
    mercadopago_connection_status,
    oauth_connect_entrypoint,
    resolve_public_backend_base_url,
)
from app.services.platform import get_service_fee_amount
from app.services.settlements import (
    get_outstanding_balance,
    get_pending_notice,
    get_store_charges,
    get_store_notices,
    get_store_payments,
)

router = APIRouter()

STORE_OPTIONS = (
    selectinload(Store.category_links).selectinload(StoreCategoryLink.category),
    selectinload(Store.payment_settings),
    selectinload(Store.payment_accounts),
)


def get_merchant_store(db: Session, user_id: int) -> Store:
    store = db.scalar(select(Store).options(*STORE_OPTIONS).where(Store.owner_user_id == user_id))
    if store is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Merchant store not found")
    return store


@router.get("/payments/mercadopago/connect-url", response_model=MercadoPagoConnectUrlRead)
def get_mercadopago_connect_url(
    request: Request,
    user: User = Depends(require_merchant),
    db: Session = Depends(get_db),
) -> MercadoPagoConnectUrlRead:
    store = get_merchant_store(db, user.id)
    get_or_create_mercadopago_provider(db)
    return MercadoPagoConnectUrlRead(
        connect_url=oauth_connect_entrypoint(base_url=resolve_public_backend_base_url(str(request.base_url))),
        connection_status=mercadopago_connection_status(store),
        status=mercadopago_connection_status(store),
        callback_url=None,
    )


@router.get("/settlements/overview", response_model=MerchantSettlementOverviewRead)
def get_settlement_overview(
    user: User = Depends(require_merchant), db: Session = Depends(get_db)
) -> MerchantSettlementOverviewRead:
    store = get_merchant_store(db, user.id)
    charges = get_store_charges(db, store.id)
    notices = get_store_notices(db, store.id)
    payments = get_store_payments(db, store.id)
    return serialize_settlement_overview(
        store=store,
        service_fee_amount=get_service_fee_amount(db),
        charges=charges,
        notices=notices,
        payments=payments,
    )


@router.get("/settlements/charges", response_model=list[MerchantServiceFeeChargeRead])
def list_settlement_charges(
    user: User = Depends(require_merchant), db: Session = Depends(get_db)
) -> list[MerchantServiceFeeChargeRead]:
    store = get_merchant_store(db, user.id)
    return [serialize_settlement_charge(charge) for charge in get_store_charges(db, store.id)]


@router.get("/settlements/notices", response_model=list[MerchantTransferNoticeRead])
def list_transfer_notices(
    user: User = Depends(require_merchant), db: Session = Depends(get_db)
) -> list[MerchantTransferNoticeRead]:
    store = get_merchant_store(db, user.id)
    return [serialize_transfer_notice(notice) for notice in get_store_notices(db, store.id)]


@router.post("/settlements/notices", response_model=MerchantTransferNoticeRead, status_code=status.HTTP_201_CREATED)
def create_transfer_notice(
    payload: MerchantTransferNoticeCreate,
    user: User = Depends(require_merchant),
    db: Session = Depends(get_db),
) -> MerchantTransferNoticeRead:
    store = get_merchant_store(db, user.id)
    if payload.amount <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Amount must be greater than zero")
    outstanding_balance = round(get_outstanding_balance(db, store.id), 2)
    if outstanding_balance <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Store has no outstanding balance")
    if get_pending_notice(db, store.id) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Store already has a transfer notice pending review",
        )
    if round(float(payload.amount), 2) != outstanding_balance:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Transfer amount must match the outstanding store balance",
        )
    if not payload.proof_url.strip() or not payload.proof_content_type.strip() or not payload.proof_original_name.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Transfer proof is required",
        )
    notice = MerchantTransferNotice(store_id=store.id, **payload.model_dump())
    db.add(notice)
    db.commit()
    db.refresh(notice)
    return serialize_transfer_notice(notice)
