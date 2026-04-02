from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.delivery import RiderSettlementPayment
from app.models.order import StoreOrder
from app.models.platform import (
    MerchantServiceFeeCharge,
    MerchantSettlementAllocation,
    MerchantSettlementPayment,
    MerchantTransferNotice,
)
from app.models.store import Store

CHARGE_OPTIONS = (
    selectinload(MerchantServiceFeeCharge.order).selectinload(StoreOrder.items),
    selectinload(MerchantServiceFeeCharge.allocations).selectinload(MerchantSettlementAllocation.payment),
)

PAYMENT_OPTIONS = (
    selectinload(MerchantSettlementPayment.store),
    selectinload(MerchantSettlementPayment.notice),
    selectinload(MerchantSettlementPayment.allocations)
    .selectinload(MerchantSettlementAllocation.charge)
    .selectinload(MerchantServiceFeeCharge.order),
)

NOTICE_OPTIONS = (
    selectinload(MerchantTransferNotice.store),
    selectinload(MerchantTransferNotice.settlement_payment).selectinload(MerchantSettlementPayment.allocations),
)

RIDER_PAYMENT_OPTIONS = (
    selectinload(RiderSettlementPayment.store),
    selectinload(RiderSettlementPayment.rider),
)


def charge_paid_amount(charge: MerchantServiceFeeCharge) -> float:
    return sum(float(allocation.amount) for allocation in charge.allocations)


def charge_outstanding_amount(charge: MerchantServiceFeeCharge) -> float:
    return max(0.0, float(charge.amount) - charge_paid_amount(charge))


def charge_status(charge: MerchantServiceFeeCharge) -> str:
    paid = charge_paid_amount(charge)
    amount = float(charge.amount)
    if paid <= 0:
        return "open"
    if paid >= amount:
        return "settled"
    return "partial"


def payment_applied_amount(payment: MerchantSettlementPayment) -> float:
    return sum(float(allocation.amount) for allocation in payment.allocations)


def get_store_charges(db: Session, store_id: int) -> list[MerchantServiceFeeCharge]:
    return db.scalars(
        select(MerchantServiceFeeCharge)
        .options(*CHARGE_OPTIONS)
        .where(MerchantServiceFeeCharge.store_id == store_id)
        .order_by(MerchantServiceFeeCharge.created_at.asc(), MerchantServiceFeeCharge.id.asc())
    ).all()


def get_store_notices(db: Session, store_id: int) -> list[MerchantTransferNotice]:
    return db.scalars(
        select(MerchantTransferNotice)
        .options(*NOTICE_OPTIONS)
        .where(MerchantTransferNotice.store_id == store_id)
        .order_by(MerchantTransferNotice.created_at.desc(), MerchantTransferNotice.id.desc())
    ).all()


def get_pending_notice(db: Session, store_id: int) -> MerchantTransferNotice | None:
    return db.scalar(
        select(MerchantTransferNotice)
        .options(*NOTICE_OPTIONS)
        .where(
            MerchantTransferNotice.store_id == store_id,
            MerchantTransferNotice.status == "pending_review",
        )
        .order_by(MerchantTransferNotice.created_at.desc(), MerchantTransferNotice.id.desc())
    )


def get_store_payments(db: Session, store_id: int) -> list[MerchantSettlementPayment]:
    return db.scalars(
        select(MerchantSettlementPayment)
        .options(*PAYMENT_OPTIONS)
        .where(MerchantSettlementPayment.store_id == store_id)
        .order_by(MerchantSettlementPayment.paid_at.desc(), MerchantSettlementPayment.id.desc())
    ).all()


def get_outstanding_balance(db: Session, store_id: int) -> float:
    charges = get_store_charges(db, store_id)
    return sum(charge_outstanding_amount(charge) for charge in charges)


def get_store_rider_payments(db: Session, store_id: int) -> list[RiderSettlementPayment]:
    return db.scalars(
        select(RiderSettlementPayment)
        .options(*RIDER_PAYMENT_OPTIONS)
        .where(RiderSettlementPayment.store_id == store_id)
        .order_by(RiderSettlementPayment.paid_at.desc(), RiderSettlementPayment.id.desc())
    ).all()


def get_rider_payments(
    db: Session,
    *,
    rider_user_id: int,
    store_id: int | None = None,
) -> list[RiderSettlementPayment]:
    query = (
        select(RiderSettlementPayment)
        .options(*RIDER_PAYMENT_OPTIONS)
        .where(RiderSettlementPayment.rider_user_id == rider_user_id)
        .order_by(RiderSettlementPayment.paid_at.desc(), RiderSettlementPayment.id.desc())
    )
    if store_id is not None:
        query = query.where(RiderSettlementPayment.store_id == store_id)
    return db.scalars(query).all()


def create_cash_service_fee_charge(db: Session, order: StoreOrder) -> MerchantServiceFeeCharge | None:
    if order.payment_method != "cash" or order.status != "delivered":
        return None
    amount = float(order.service_fee)
    if amount <= 0:
        return None
    existing = db.scalar(
        select(MerchantServiceFeeCharge).where(MerchantServiceFeeCharge.order_id == order.id)
    )
    if existing is not None:
        return existing
    charge = MerchantServiceFeeCharge(store_id=order.store_id, order_id=order.id, amount=amount)
    db.add(charge)
    db.flush()
    return charge


def apply_payment_to_oldest_charges(db: Session, payment: MerchantSettlementPayment) -> float:
    remaining = float(payment.amount)
    charges = get_store_charges(db, payment.store_id)
    for charge in charges:
        outstanding = charge_outstanding_amount(charge)
        if outstanding <= 0:
            continue
        applied = min(remaining, outstanding)
        if applied <= 0:
            continue
        db.add(
            MerchantSettlementAllocation(
                payment_id=payment.id,
                charge_id=charge.id,
                amount=applied,
            )
        )
        remaining -= applied
        if remaining <= 0:
            break
    db.flush()
    return remaining


def approve_notice_to_payment(
    db: Session,
    notice: MerchantTransferNotice,
    *,
    created_by_user_id: int | None,
    review_notes: str | None,
) -> MerchantSettlementPayment:
    payment = MerchantSettlementPayment(
        store_id=notice.store_id,
        notice_id=notice.id,
        source="merchant_notice",
        amount=notice.amount,
        paid_at=datetime.combine(notice.transfer_date, datetime.min.time(), tzinfo=UTC),
        reference=notice.reference,
        notes=notice.notes,
        created_by_user_id=created_by_user_id,
    )
    db.add(payment)
    db.flush()
    remaining = apply_payment_to_oldest_charges(db, payment)
    if remaining > 0:
        raise ValueError("Payment amount exceeds outstanding store balance")
    notice.status = "approved"
    notice.review_notes = review_notes
    notice.reviewed_by_user_id = created_by_user_id
    notice.reviewed_at = datetime.now(UTC)
    db.flush()
    return payment


def reject_notice(
    notice: MerchantTransferNotice, *, reviewed_by_user_id: int | None, review_notes: str | None
) -> None:
    notice.status = "rejected"
    notice.review_notes = review_notes
    notice.reviewed_by_user_id = reviewed_by_user_id
    notice.reviewed_at = datetime.now(UTC)
