from __future__ import annotations

import calendar
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.delivery import DeliveryAssignment, DeliveryZone
from app.models.order import StoreOrder
from app.models.store import Product
from app.services.order_visibility import PAID_MERCADOPAGO_STATUSES

TERMINAL_CANCELLED_STATUSES = {"cancelled", "delivery_failed", "rejected"}
VISIBLE_ORDER_FILTER = or_(
    StoreOrder.payment_method != "mercadopago",
    StoreOrder.payment_status.in_(PAID_MERCADOPAGO_STATUSES),
)


@dataclass(frozen=True)
class MerchantStatsPeriod:
    start_date: date
    end_date: date
    comparison: str
    compare_start_date: date
    compare_end_date: date
    target_start: datetime
    target_end: datetime
    compare_start: datetime
    compare_end: datetime


def _as_float(value: object) -> float:
    return float(value or 0)


def _date_start(value: date) -> datetime:
    return datetime.combine(value, time.min, tzinfo=UTC)


def _coerce_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value


def _shift_month(value: date, months: int) -> date:
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    day = min(value.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def resolve_stats_period(start_date: date, end_date: date, comparison: str) -> MerchantStatsPeriod:
    if end_date < start_date:
        raise ValueError("end_date must be greater than or equal to start_date")
    if (end_date - start_date).days > 366:
        raise ValueError("Stats range cannot be longer than 366 days")

    duration_days = (end_date - start_date).days + 1
    comparison_key = comparison if comparison in {"previous_period", "same_week_previous", "same_month_previous"} else "previous_period"

    if comparison_key == "same_week_previous":
        compare_start_date = start_date - timedelta(days=7)
        compare_end_date = end_date - timedelta(days=7)
    elif comparison_key == "same_month_previous":
        compare_start_date = _shift_month(start_date, -1)
        compare_end_date = _shift_month(end_date, -1)
    else:
        compare_end_date = start_date - timedelta(days=1)
        compare_start_date = compare_end_date - timedelta(days=duration_days - 1)

    return MerchantStatsPeriod(
        start_date=start_date,
        end_date=end_date,
        comparison=comparison_key,
        compare_start_date=compare_start_date,
        compare_end_date=compare_end_date,
        target_start=_date_start(start_date),
        target_end=_date_start(end_date + timedelta(days=1)),
        compare_start=_date_start(compare_start_date),
        compare_end=_date_start(compare_end_date + timedelta(days=1)),
    )


def period_payload(period: MerchantStatsPeriod) -> dict[str, object]:
    return {
        "start_date": period.start_date,
        "end_date": period.end_date,
        "comparison": period.comparison,
        "compare_start_date": period.compare_start_date,
        "compare_end_date": period.compare_end_date,
    }


def _change_pct(current: float, previous: float) -> float:
    if previous == 0:
        return 100.0 if current > 0 else 0.0
    return round(((current - previous) / previous) * 100, 1)


def _orders_for_periods(db: Session, store_id: int, period: MerchantStatsPeriod) -> list[StoreOrder]:
    return list(
        db.scalars(
            select(StoreOrder)
            .options(
                selectinload(StoreOrder.items),
                selectinload(StoreOrder.delivery_assignment),
                selectinload(StoreOrder.delivery_zone),
            )
            .where(
                StoreOrder.store_id == store_id,
                StoreOrder.created_at >= period.compare_start,
                StoreOrder.created_at < period.target_end,
                VISIBLE_ORDER_FILTER,
            )
            .order_by(StoreOrder.created_at.asc(), StoreOrder.id.asc())
        )
    )


def _split_period_orders(orders: list[StoreOrder], period: MerchantStatsPeriod) -> tuple[list[StoreOrder], list[StoreOrder]]:
    target_orders: list[StoreOrder] = []
    compare_orders: list[StoreOrder] = []
    for order in orders:
        created_at = _coerce_utc(order.created_at)
        if period.target_start <= created_at < period.target_end:
            target_orders.append(order)
        elif period.compare_start <= created_at < period.compare_end:
            compare_orders.append(order)
    return target_orders, compare_orders


def _delivered_orders(orders: list[StoreOrder]) -> list[StoreOrder]:
    return [order for order in orders if order.status == "delivered"]


def _gross_sales(orders: list[StoreOrder]) -> float:
    return round(sum(_as_float(order.total) for order in _delivered_orders(orders)), 2)


def _net_sales(orders: list[StoreOrder]) -> float:
    return round(
        sum(
            _as_float(order.subtotal)
            - _as_float(order.commercial_discount_total)
            - _as_float(order.financial_discount_total)
            for order in _delivered_orders(orders)
        ),
        2,
    )


def _avg(values: list[float]) -> float:
    return round(sum(values) / len(values), 1) if values else 0.0


def _minutes_between(start: datetime | None, end: datetime | None) -> float | None:
    if not start or not end:
        return None
    normalized_start = _coerce_utc(start)
    normalized_end = _coerce_utc(end)
    if normalized_end < normalized_start:
        return None
    return round((normalized_end - normalized_start).total_seconds() / 60, 1)


def _repeat_rate(db: Session, store_id: int, period: MerchantStatsPeriod, target_orders: list[StoreOrder]) -> tuple[int, float]:
    target_user_ids = {order.user_id for order in target_orders if order.user_id is not None}
    if not target_user_ids:
        return 0, 0.0

    rows = db.execute(
        select(StoreOrder.user_id, StoreOrder.created_at)
        .where(
            StoreOrder.store_id == store_id,
            StoreOrder.user_id.in_(target_user_ids),
            StoreOrder.created_at < period.target_end,
            VISIBLE_ORDER_FILTER,
        )
        .order_by(StoreOrder.user_id.asc(), StoreOrder.created_at.asc())
    ).all()
    orders_by_user: dict[int, list[datetime]] = defaultdict(list)
    for user_id, created_at in rows:
        if user_id is not None:
            orders_by_user[int(user_id)].append(_coerce_utc(created_at))

    repeat_customers = 0
    for user_id in target_user_ids:
        dates = orders_by_user.get(int(user_id), [])
        had_previous = any(created_at < period.target_start for created_at in dates)
        target_count = sum(1 for created_at in dates if period.target_start <= created_at < period.target_end)
        if had_previous or target_count > 1:
            repeat_customers += 1

    return repeat_customers, round((repeat_customers / len(target_user_ids)) * 100, 1)


def build_stats_overview(db: Session, store_id: int, period: MerchantStatsPeriod) -> dict[str, object]:
    target_orders, compare_orders = _split_period_orders(_orders_for_periods(db, store_id, period), period)
    target_delivered = _delivered_orders(target_orders)
    compare_delivered = _delivered_orders(compare_orders)
    gross_sales = _gross_sales(target_orders)
    compare_gross_sales = _gross_sales(compare_orders)
    net_sales = _net_sales(target_orders)
    compare_net_sales = _net_sales(compare_orders)
    delivered_count = len(target_delivered)
    cancelled_count = sum(1 for order in target_orders if order.status in TERMINAL_CANCELLED_STATUSES)
    rejected_count = sum(1 for order in target_orders if order.status == "rejected")
    unique_customers = len({order.user_id for order in target_orders if order.user_id is not None})
    _, repeat_rate = _repeat_rate(db, store_id, period, target_orders)
    avg_prep = _avg(
        [
            value
            for order in target_orders
            if (value := _minutes_between(order.created_at, order.merchant_ready_at)) is not None
        ]
    )
    avg_delivery = _avg(
        [
            value
            for order in target_orders
            if (value := _minutes_between(order.out_for_delivery_at, order.delivered_at)) is not None
        ]
    )
    average_ticket = round(gross_sales / delivered_count, 2) if delivered_count else 0.0
    cancellation_rate = round((cancelled_count / len(target_orders)) * 100, 1) if target_orders else 0.0
    compare_cancelled = sum(1 for order in compare_orders if order.status in TERMINAL_CANCELLED_STATUSES)
    compare_cancellation_rate = round((compare_cancelled / len(compare_orders)) * 100, 1) if compare_orders else 0.0
    compare_average_ticket = round(compare_gross_sales / len(compare_delivered), 2) if compare_delivered else 0.0

    insights: list[dict[str, str]] = []
    sales_change = _change_pct(gross_sales, compare_gross_sales)
    if sales_change > 0:
        insights.append({"tone": "success", "title": "Ventas en alza", "description": f"Tus ventas crecieron {sales_change:.1f}% contra la comparacion."})
    elif sales_change < 0:
        insights.append({"tone": "danger", "title": "Ventas en baja", "description": f"Tus ventas cayeron {abs(sales_change):.1f}% contra la comparacion."})
    ticket_change = _change_pct(average_ticket, compare_average_ticket)
    if ticket_change < -8:
        insights.append({"tone": "warning", "title": "Ticket promedio menor", "description": f"El ticket promedio bajo {abs(ticket_change):.1f}%. Revisa combos y minimo de compra."})
    if cancellation_rate > compare_cancellation_rate and cancellation_rate >= 8:
        insights.append({"tone": "danger", "title": "Cancelaciones en aumento", "description": f"La tasa de cancelacion llego a {cancellation_rate:.1f}%."})
    if avg_prep > 25:
        insights.append({"tone": "warning", "title": "Preparacion lenta", "description": f"El tiempo promedio de preparacion es {avg_prep:.0f} min."})
    if not insights:
        insights.append({"tone": "neutral", "title": "Operacion estable", "description": "No se detectan alertas criticas en el periodo seleccionado."})

    return {
        "period": period_payload(period),
        "kpis": {
            "gross_sales": gross_sales,
            "net_sales": net_sales,
            "gross_sales_change_pct": sales_change,
            "net_sales_change_pct": _change_pct(net_sales, compare_net_sales),
            "total_orders": len(target_orders),
            "total_orders_change_pct": _change_pct(len(target_orders), len(compare_orders)),
            "delivered_orders": delivered_count,
            "cancelled_orders": cancelled_count,
            "rejected_orders": rejected_count,
            "average_ticket": average_ticket,
            "average_ticket_change_pct": ticket_change,
            "unique_customers": unique_customers,
            "repeat_rate": repeat_rate,
            "avg_preparation_minutes": avg_prep,
            "avg_delivery_minutes": avg_delivery,
            "cancellation_rate": cancellation_rate,
            "cancellation_rate_change_pct": _change_pct(cancellation_rate, compare_cancellation_rate),
        },
        "insights": insights,
    }


def _day_key(value: datetime) -> date:
    return _coerce_utc(value).date()


def build_stats_sales(db: Session, store_id: int, period: MerchantStatsPeriod) -> dict[str, object]:
    target_orders, _ = _split_period_orders(_orders_for_periods(db, store_id, period), period)
    days = [period.start_date + timedelta(days=index) for index in range((period.end_date - period.start_date).days + 1)]
    daily: list[dict[str, object]] = []
    for item_date in days:
        day_orders = [order for order in target_orders if _day_key(order.created_at) == item_date]
        delivered = _delivered_orders(day_orders)
        gross = _gross_sales(day_orders)
        daily.append(
            {
                "date": item_date,
                "label": item_date.strftime("%d/%m"),
                "gross_sales": gross,
                "net_sales": _net_sales(day_orders),
                "orders": len(day_orders),
                "delivered_orders": len(delivered),
                "average_ticket": round(gross / len(delivered), 2) if delivered else 0.0,
            }
        )

    hourly = []
    for hour in range(24):
        hour_orders = [order for order in target_orders if _coerce_utc(order.created_at).hour == hour]
        hourly.append(
            {"hour": hour, "label": f"{hour:02d} hs", "orders": len(hour_orders), "gross_sales": _gross_sales(hour_orders)}
        )

    weekday_names = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"]
    weekdays = []
    for weekday in range(7):
        day_orders = [order for order in target_orders if order.created_at.weekday() == weekday]
        delivered = _delivered_orders(day_orders)
        gross = _gross_sales(day_orders)
        weekdays.append(
            {
                "weekday": weekday,
                "label": weekday_names[weekday],
                "orders": len(day_orders),
                "gross_sales": gross,
                "average_ticket": round(gross / len(delivered), 2) if delivered else 0.0,
            }
        )

    return {"period": period_payload(period), "daily": daily, "hourly": hourly, "weekdays": weekdays}


def _product_rows(orders: list[StoreOrder]) -> dict[int | str, dict[str, object]]:
    rows: dict[int | str, dict[str, object]] = {}
    for order in _delivered_orders(orders):
        for item in order.items:
            key: int | str = item.product_id if item.product_id is not None else f"legacy:{item.product_name_snapshot}"
            current = rows.setdefault(
                key,
                {
                    "product_id": item.product_id,
                    "product_name": item.product_name_snapshot,
                    "quantity_sold": 0,
                    "revenue": 0.0,
                    "margin": 0.0,
                },
            )
            quantity = int(item.quantity or 0)
            revenue = _as_float(item.unit_price_snapshot) * quantity
            discount = _as_float(item.commercial_discount_amount_snapshot) * quantity
            current["quantity_sold"] = int(current["quantity_sold"]) + quantity
            current["revenue"] = round(float(current["revenue"]) + revenue, 2)
            current["margin"] = round(float(current["margin"]) + max(revenue - discount, 0), 2)
    return rows


def build_stats_products(db: Session, store_id: int, period: MerchantStatsPeriod) -> dict[str, object]:
    target_orders, compare_orders = _split_period_orders(_orders_for_periods(db, store_id, period), period)
    target_rows = _product_rows(target_orders)
    compare_rows = _product_rows(compare_orders)
    top_products = []
    for key, row in target_rows.items():
        previous = compare_rows.get(key, {})
        top_products.append(
            {
                **row,
                "trend_pct": _change_pct(float(row["revenue"]), float(previous.get("revenue", 0))),
            }
        )
    top_products.sort(key=lambda item: (float(item["revenue"]), int(item["quantity_sold"])), reverse=True)

    product_catalog = db.scalars(
        select(Product).where(Product.store_id == store_id).order_by(Product.sort_order.asc(), Product.name.asc())
    ).all()
    sold_product_ids = {int(row["product_id"]) for row in target_rows.values() if row.get("product_id") is not None}
    low_performance: list[dict[str, object]] = []
    for product in product_catalog:
        if product.id not in sold_product_ids:
            low_performance.append(
                {
                    "product_id": product.id,
                    "product_name": product.name,
                    "reason": "Sin ventas en el periodo",
                    "recommendation": "Revisa precio, foto, stock o sumalo a una promocion.",
                    "severity": "warning" if product.is_available else "neutral",
                }
            )
    for item in top_products:
        if float(item["trend_pct"]) <= -25:
            low_performance.append(
                {
                    "product_id": item["product_id"],
                    "product_name": item["product_name"],
                    "reason": f"Cayo {abs(float(item['trend_pct'])):.1f}% contra la comparacion",
                    "recommendation": "Revisa cambios de precio, disponibilidad y posicion en catalogo.",
                    "severity": "danger",
                }
            )

    return {
        "period": period_payload(period),
        "top_products": top_products[:12],
        "low_performance": low_performance[:8],
    }


def _customer_name(order: StoreOrder) -> str:
    return order.customer_name_snapshot or f"Cliente #{order.user_id}"


def build_stats_customers(db: Session, store_id: int, period: MerchantStatsPeriod) -> dict[str, object]:
    target_orders, _ = _split_period_orders(_orders_for_periods(db, store_id, period), period)
    target_user_ids = {order.user_id for order in target_orders if order.user_id is not None}
    history_rows: list[Any] = db.execute(
        select(StoreOrder.user_id, StoreOrder.customer_name_snapshot, StoreOrder.total, StoreOrder.created_at)
        .where(
            StoreOrder.store_id == store_id,
            StoreOrder.user_id.in_(target_user_ids) if target_user_ids else StoreOrder.user_id.is_(None),
            StoreOrder.created_at < period.target_end,
            VISIBLE_ORDER_FILTER,
        )
        .order_by(StoreOrder.user_id.asc(), StoreOrder.created_at.asc())
    ).all()
    by_user: dict[int, list[Row[Any]]] = defaultdict(list)
    for row in history_rows:
        if row.user_id is not None:
            by_user[int(row.user_id)].append(row)

    new_customers = 0
    recurrent_customers = 0
    top_customers = []
    frequency_values: list[float] = []
    for user_id, rows in by_user.items():
        target_rows = [row for row in rows if period.target_start <= _coerce_utc(row.created_at) < period.target_end]
        if not target_rows:
            continue
        had_previous = any(_coerce_utc(row.created_at) < period.target_start for row in rows)
        if had_previous or len(target_rows) > 1:
            recurrent_customers += 1
        else:
            new_customers += 1
        dates = [row.created_at for row in rows]
        if len(dates) > 1:
            normalized_dates = [_coerce_utc(item) for item in dates]
            gaps = [
                (normalized_dates[index] - normalized_dates[index - 1]).total_seconds() / 86400
                for index in range(1, len(normalized_dates))
            ]
            frequency_values.extend(gaps)
        spent = sum(_as_float(row.total) for row in target_rows)
        top_customers.append(
            {
                "customer_id": user_id,
                "customer_name": target_rows[-1].customer_name_snapshot,
                "orders": len(target_rows),
                "total_spent": round(spent, 2),
                "frequency_days": round(sum(gaps) / len(gaps), 1) if len(dates) > 1 else None,
            }
        )
    top_customers.sort(key=lambda item: (float(item["total_spent"]), int(item["orders"])), reverse=True)

    return {
        "period": period_payload(period),
        "new_vs_recurrent": {"new_customers": new_customers, "recurrent_customers": recurrent_customers},
        "top_customers": top_customers[:10],
        "frequency": {"average_days_between_orders": _avg(frequency_values)},
    }


def _zone_label(order: StoreOrder) -> str:
    zone = getattr(order, "delivery_zone", None)
    if isinstance(zone, DeliveryZone) and zone.name:
        return zone.name
    parts = [part.strip() for part in (order.address_full_snapshot or "").split(",") if part.strip()]
    if len(parts) >= 3:
        return parts[2]
    return "Zona sin clasificar"


def build_stats_delivery(db: Session, store_id: int, period: MerchantStatsPeriod) -> dict[str, object]:
    target_orders, _ = _split_period_orders(_orders_for_periods(db, store_id, period), period)
    rider_rows: dict[int, dict[str, object]] = {}
    zone_counter: Counter[str] = Counter()
    distances: list[float] = []
    charged = 0.0
    rider_cost = 0.0

    for order in target_orders:
        if order.delivery_mode != "delivery":
            continue
        zone_counter[_zone_label(order)] += 1
        charged += _as_float(order.delivery_fee_customer)
        rider_cost += _as_float(order.rider_fee)
        assignment = getattr(order, "delivery_assignment", None)
        if isinstance(assignment, DeliveryAssignment) and assignment.distance_km is not None:
            distances.append(_as_float(assignment.distance_km))
        rider_id = order.assigned_rider_id
        if rider_id is None:
            continue
        row = rider_rows.setdefault(
            int(rider_id),
            {
                "rider_user_id": rider_id,
                "rider_name": order.assigned_rider_name_snapshot or f"Repartidor #{rider_id}",
                "delivered_orders": 0,
                "cancelled_orders": 0,
                "generated_revenue": 0.0,
                "avg_delivery_minutes": 0.0,
                "_delivery_times": [],
            },
        )
        if order.status == "delivered":
            row["delivered_orders"] = int(row["delivered_orders"]) + 1
            row["generated_revenue"] = round(float(row["generated_revenue"]) + _as_float(order.total), 2)
        if order.status in TERMINAL_CANCELLED_STATUSES:
            row["cancelled_orders"] = int(row["cancelled_orders"]) + 1
        delivery_minutes = _minutes_between(order.out_for_delivery_at, order.delivered_at)
        if delivery_minutes is not None:
            row["_delivery_times"].append(delivery_minutes)

    rider_performance = []
    for row in rider_rows.values():
        times = list(row.pop("_delivery_times"))
        row["avg_delivery_minutes"] = _avg(times)
        rider_performance.append(row)
    rider_performance.sort(key=lambda item: (int(item["delivered_orders"]), float(item["generated_revenue"])), reverse=True)

    return {
        "period": period_payload(period),
        "riders": rider_performance,
        "zones": [{"zone": zone, "orders": orders} for zone, orders in zone_counter.most_common(8)],
        "distance": {"average_km": _avg(distances)},
        "costs": {
            "delivery_charged": round(charged, 2),
            "rider_cost": round(rider_cost, 2),
            "subsidized": round(max(rider_cost - charged, 0), 2),
            "profit": round(charged - rider_cost, 2),
        },
    }


def build_stats_financial(
    db: Session,
    store_id: int,
    period: MerchantStatsPeriod,
    *,
    settlement_overview: dict[str, object],
) -> dict[str, object]:
    target_orders, _ = _split_period_orders(_orders_for_periods(db, store_id, period), period)
    payment_rows = []
    for method in ("cash", "mercadopago", "transfer"):
        method_orders = [order for order in target_orders if order.payment_method == method]
        total = _gross_sales(method_orders)
        payment_rows.append({"method": method, "orders": len(method_orders), "total": total})

    days = [period.start_date + timedelta(days=index) for index in range((period.end_date - period.start_date).days + 1)]
    cashflow = []
    for item_date in days:
        day_orders = [order for order in target_orders if _day_key(order.created_at) == item_date]
        revenue = _gross_sales(day_orders)
        service_fees = round(sum(_as_float(order.service_fee) for order in _delivered_orders(day_orders)), 2)
        delivery_cost = round(sum(_as_float(order.rider_fee) for order in _delivered_orders(day_orders)), 2)
        cashflow.append(
            {
                "date": item_date,
                "label": item_date.strftime("%d/%m"),
                "revenue": revenue,
                "service_fees": service_fees,
                "delivery_cost": delivery_cost,
                "net_cash": round(revenue - service_fees - delivery_cost, 2),
            }
        )

    return {
        "period": period_payload(period),
        "settlements": settlement_overview,
        "payment_methods": payment_rows,
        "cashflow": cashflow,
    }
