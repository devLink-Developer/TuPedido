from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.payments.mercadopago.webhook_service import process_mercadopago_webhook

router = APIRouter()


@router.post("/mercadopago")
async def mercadopago_webhook(request: Request, db: Session = Depends(get_db)) -> dict[str, object]:
    return await process_mercadopago_webhook(request, db)
