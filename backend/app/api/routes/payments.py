from __future__ import annotations

import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.api.presenters import serialize_order
from app.db.session import get_db
from app.models.order import StoreOrder
from app.models.store import Store
from app.services.delivery import publish_order_snapshot
from app.services.mercadopago import (
    MercadoPagoAPIError,
    fetch_payment,
    normalize_payment_status,
)

router = APIRouter()


def _get_nested_value(payload: dict[str, Any], path: str) -> Any:
    current: Any = payload
    for part in path.split("."):
        if not isinstance(current, dict):
            return None
        current = current.get(part)
    return current


def _load_order(db: Session, reference: str) -> StoreOrder | None:
    return db.scalar(
        select(StoreOrder)
        .options(
            selectinload(StoreOrder.items),
            selectinload(StoreOrder.store),
            selectinload(StoreOrder.address),
            selectinload(StoreOrder.delivery_assignment),
            selectinload(StoreOrder.promotion_applications),
        )
        .where(StoreOrder.payment_reference == reference)
    )


def _load_store(db: Session, store_id: int) -> Store | None:
    return db.scalar(
        select(Store)
        .options(selectinload(Store.payment_accounts), selectinload(Store.payment_settings))
        .where(Store.id == store_id)
    )


def _apply_payment_status(order: StoreOrder, status_value: str) -> None:
    if order.payment_status == "approved" and status_value != "approved":
        return
    if order.payment_status == "cancelled" and status_value == "pending":
        return
    order.payment_status = status_value
    if status_value in {"cancelled", "rejected"}:
        order.status = "cancelled"


@router.post("/mercadopago/webhook")
async def mercadopago_webhook(
    request: Request, db: Session = Depends(get_db)
) -> dict[str, object]:
    query_params = request.query_params
    raw_body = await request.body()
    payload: dict[str, Any] = {}
    if raw_body:
        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            payload = {}

    simulated_reference = payload.get("reference")
    simulated_status = payload.get("status")
    if simulated_reference and simulated_status:
        order = _load_order(db, str(simulated_reference))
        if order is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
        _apply_payment_status(order, str(simulated_status))
        db.commit()
        db.refresh(order)
        publish_order_snapshot(order, event_type="payment.updated")
        return serialize_order(order).model_dump()

    event_type = (
        query_params.get("type")
        or query_params.get("topic")
        or payload.get("type")
        or payload.get("topic")
    )
    if event_type not in {None, "", "payment"}:
        return {"status": "ignored", "reason": "unsupported_event"}

    reference = (
        query_params.get("reference")
        or payload.get("reference")
        or _get_nested_value(payload, "data.external_reference")
    )
    payment_id = (
        query_params.get("data.id")
        or query_params.get("id")
        or _get_nested_value(payload, "data.id")
        or payload.get("id")
    )
    if payment_id is None:
        return {"status": "ignored", "reason": "missing_payment_id"}

    store_id_raw = query_params.get("store_id") or payload.get("store_id")
    order = _load_order(db, reference) if reference else None
    store_id = int(store_id_raw) if store_id_raw else (order.store_id if order else None)
    if store_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Store id is required")

    store = _load_store(db, store_id)
    if store is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")

    try:
        payment = fetch_payment(payment_id, store)
    except MercadoPagoAPIError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    reference_from_payment = payment.get("external_reference")
    effective_reference = str(reference_from_payment or reference or "")
    if not effective_reference:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment reference not found")

    if order is None or order.payment_reference != effective_reference:
        order = _load_order(db, effective_reference)
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    _apply_payment_status(order, normalize_payment_status(payment.get("status")))
    db.commit()
    db.refresh(order)
    publish_order_snapshot(order, event_type="payment.updated")
    return serialize_order(order).model_dump()
