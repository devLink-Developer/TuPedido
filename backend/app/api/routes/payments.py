from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.payments.mercadopago.payment_service import create_card_payment, get_payment_session
from app.modules.payments.mercadopago.webhook_service import process_mercadopago_webhook
from app.schemas.order import MercadoPagoCardPaymentRequest, MercadoPagoCardPaymentResponse, MercadoPagoPaymentSessionRead
from app.services.delivery import publish_order_snapshot
from app.services.mercadopago import MercadoPagoAPIError

router = APIRouter()


@router.get("/mercadopago/session/{session_token}", response_model=MercadoPagoPaymentSessionRead)
def mercadopago_payment_session(
    session_token: str,
    db: Session = Depends(get_db),
) -> MercadoPagoPaymentSessionRead:
    try:
        return get_payment_session(db, session_token)
    except MercadoPagoAPIError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/mercadopago/card-payment", response_model=MercadoPagoCardPaymentResponse)
def mercadopago_card_payment(
    payload: MercadoPagoCardPaymentRequest,
    db: Session = Depends(get_db),
) -> MercadoPagoCardPaymentResponse:
    try:
        response, merchant_visible_now = create_card_payment(db, payload)
        db.commit()
        publish_order_snapshot_id = response.order_id
    except MercadoPagoAPIError as exc:
        db.commit()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    # Reload through the normal order route in clients; this publish keeps live panels in sync.
    if publish_order_snapshot_id:
        from sqlalchemy import select
        from app.models.order import StoreOrder

        order = db.scalar(select(StoreOrder).where(StoreOrder.id == publish_order_snapshot_id))
        if order is not None:
            publish_order_snapshot(order, event_type="order.created" if merchant_visible_now else "payment.updated")
    return response


@router.post("/mercadopago/webhook")
async def mercadopago_webhook_legacy(request: Request, db: Session = Depends(get_db)) -> dict[str, object]:
    return await process_mercadopago_webhook(request, db)
