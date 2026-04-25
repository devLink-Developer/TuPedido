from __future__ import annotations

import copy
import hashlib
import hmac
import os
import sys
import time
from decimal import Decimal
from pathlib import Path

DB_PATH = Path(__file__).with_name("smoke_mp_real_checkout_webhook.db")
WEBHOOK_SECRET = "SMOKE-WEBHOOK-SECRET"
WEBHOOK_TS = str(int(time.time() * 1000))
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


class FakeResponse:
    def __init__(self, status_code: int, payload: dict[str, object]) -> None:
        self.status_code = status_code
        self._payload = payload
        self.text = str(payload)

    def json(self) -> dict[str, object]:
        return self._payload


def _money(value: object) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.01"))


def _sum_items(items: list[dict[str, object]]) -> Decimal:
    return sum(
        (_money(item["unit_price"]) * Decimal(int(item["quantity"])) for item in items),
        Decimal("0.00"),
    ).quantize(Decimal("0.01"))


def configure_environment() -> None:
    os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
    os.environ["APP_ENV"] = "development"
    os.environ["SEED_DEMO_DATA"] = "true"
    os.environ["MERCADOPAGO_SIMULATED"] = "false"
    os.environ["MERCADOPAGO_CLIENT_ID"] = "SMOKE-CLIENT-ID"
    os.environ["MERCADOPAGO_CLIENT_SECRET"] = "SMOKE-CLIENT-SECRET"
    os.environ["MERCADOPAGO_WEBHOOK_SECRET"] = WEBHOOK_SECRET
    os.environ["MERCADOPAGO_REDIRECT_URI"] = "http://localhost:8016/api/v1/oauth/mercadopago/callback"
    os.environ["FRONTEND_BASE_URL"] = "http://localhost:8015"
    os.environ["BACKEND_BASE_URL"] = "http://localhost:8016"


def _login(client, email: str, password: str) -> dict[str, str]:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    response.raise_for_status()
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _prepare_customer_checkout(client) -> tuple[dict[str, str], dict[str, object], int]:
    customer_headers = _login(client, "cliente@kepedimos.example.com", "cliente123")
    store = client.get("/api/v1/catalog/stores").json()[0]
    address_id = client.get("/api/v1/addresses", headers=customer_headers).json()[0]["id"]
    return customer_headers, store, address_id


def _assert_split_payload(payload: dict[str, object], order: dict[str, object]) -> None:
    items = payload["items"]
    marketplace_fee = _money(payload["marketplace_fee"])
    order_total = _money(order["total"])
    service_fee = _money(order["service_fee"])

    assert _sum_items(items) == order_total
    assert marketplace_fee == service_fee
    assert _sum_items(items) - marketplace_fee == order_total - service_fee
    assert sum(1 for item in items if item["title"] == "Envio") == 1
    assert sum(1 for item in items if item["title"] == "Servicio") == 1


def _payment_payload(
    *, reference: str, order: dict[str, object], payment_id: str = "987654"
) -> dict[str, object]:
    return {
        "id": payment_id,
        "status": "approved",
        "status_detail": "accredited",
        "external_reference": reference,
        "transaction_amount": order["total"],
        "currency_id": "ARS",
        "collector_id": "123456789",
        "marketplace_fee": order["service_fee"],
        "live_mode": False,
    }


def _webhook_headers(payment_id: str = "987654") -> dict[str, str]:
    request_id = f"smoke-request-{payment_id}"
    manifest = f"id:{payment_id};request-id:{request_id};ts:{WEBHOOK_TS};"
    signature = hmac.new(WEBHOOK_SECRET.encode(), msg=manifest.encode(), digestmod=hashlib.sha256).hexdigest()
    return {"x-request-id": request_id, "x-signature": f"ts={WEBHOOK_TS},v1={signature}"}


def _approve_checkout_order(
    client,
    *,
    store_id: int,
    reference: str,
    payment_id: str = "987654",
    include_query_context: bool = True,
) -> None:
    query = f"type=payment&data.id={payment_id}"
    if include_query_context:
        query = f"store_id={store_id}&reference={reference}&{query}"
    webhook = client.post(
        f"/api/v1/payments/mercadopago/webhook?{query}",
        json={"type": "payment", "data": {"id": payment_id}},
        headers=_webhook_headers(payment_id),
    )
    webhook.raise_for_status()
    assert webhook.json()["payment_status"] == "approved"


def _run_delivery_split_scenario(client, mp) -> None:
    captured: dict[str, object] = {"requests": []}
    original_request = mp.httpx.request

    def fake_request(method: str, url: str, headers=None, json=None, timeout=None):  # type: ignore[no-untyped-def]
        normalized_method = method.upper()
        if normalized_method == "POST" and url.endswith("/checkout/preferences"):
            captured["preference_payload"] = copy.deepcopy(json)
            captured["requests"].append({"authorization": headers["Authorization"], "url": url})
            return FakeResponse(
                201,
                {
                    "id": "pref_123",
                    "init_point": "https://www.mercadopago.com/checkout/v1/redirect?pref_id=pref_123",
                    "sandbox_init_point": "https://sandbox.mercadopago.com/checkout/v1/redirect?pref_id=pref_123",
                },
            )
        if normalized_method == "GET" and "/v1/payments/" in url:
            captured["requests"].append({"authorization": headers["Authorization"], "url": url})
            return FakeResponse(
                200,
                {
                    **_payment_payload(reference=captured["reference"], order=captured["order"]),
                },
            )
        raise AssertionError(f"Unexpected Mercado Pago request: {normalized_method} {url}")

    mp.httpx.request = fake_request
    try:
        customer_headers, store, address_id = _prepare_customer_checkout(client)
        client.post(
            "/api/v1/cart/items",
            headers=customer_headers,
            json={"store_id": store["id"], "product_id": 1, "quantity": 2},
        ).raise_for_status()

        checkout = client.post(
            "/api/v1/checkout",
            headers=customer_headers,
            json={
                "store_id": store["id"],
                "address_id": address_id,
                "delivery_mode": "delivery",
                "payment_method": "mercadopago",
            },
        )
        checkout.raise_for_status()
        checkout_payload = checkout.json()
        captured["reference"] = checkout_payload["payment_reference"]
        assert checkout_payload["checkout_url"] is not None

        order = client.get(f"/api/v1/orders/{checkout_payload['order_id']}", headers=customer_headers)
        order.raise_for_status()
        order_payload = order.json()
        captured["order"] = order_payload
        _assert_split_payload(captured["preference_payload"], order_payload)
        assert captured["requests"][0]["authorization"] == "Bearer TEST-ACCESS-TOKEN-1234"

        _approve_checkout_order(client, store_id=store["id"], reference=captured["reference"])

        approved_order = client.get(f"/api/v1/orders/{checkout_payload['order_id']}", headers=customer_headers)
        approved_order.raise_for_status()
        assert approved_order.json()["payment_status"] == "approved"
    finally:
        mp.httpx.request = original_request


def _create_smoke_promotion(client, merchant_headers: dict[str, str]) -> None:
    products_response = client.get("/api/v1/merchant/products", headers=merchant_headers)
    products_response.raise_for_status()
    products = {item["name"]: item for item in products_response.json()}
    promotion = client.post(
        "/api/v1/merchant/promotions",
        headers=merchant_headers,
        json={
            "name": "Split Smoke Promo",
            "description": "Promocion para validar el fallback de Mercado Pago.",
            "sale_price": 8.00,
            "max_per_customer_per_day": 5,
            "is_active": True,
            "sort_order": 0,
            "items": [
                {"product_id": products["Yerba Premium 1kg"]["id"], "quantity": 1, "sort_order": 0},
                {"product_id": products["Gaseosa Cola 1.5L"]["id"], "quantity": 1, "sort_order": 1},
            ],
        },
    )
    promotion.raise_for_status()


def _run_promotions_fallback_scenario(client, mp) -> None:
    captured: dict[str, object] = {"payloads": [], "requests": []}
    original_request = mp.httpx.request

    def fake_request(method: str, url: str, headers=None, json=None, timeout=None):  # type: ignore[no-untyped-def]
        normalized_method = method.upper()
        if normalized_method == "POST" and url.endswith("/checkout/preferences"):
            captured["payloads"].append(copy.deepcopy(json))
            captured["requests"].append({"authorization": headers["Authorization"], "url": url})
            if len(captured["payloads"]) == 1 and any(float(item["unit_price"]) < 0 for item in json["items"]):
                return FakeResponse(400, {"message": "unit_price invalid"})
            return FakeResponse(
                201,
                {
                    "id": "pref_retry",
                    "init_point": "https://www.mercadopago.com/checkout/v1/redirect?pref_id=pref_retry",
                    "sandbox_init_point": "https://sandbox.mercadopago.com/checkout/v1/redirect?pref_id=pref_retry",
                },
            )
        if normalized_method == "GET" and "/v1/payments/" in url:
            captured["requests"].append({"authorization": headers["Authorization"], "url": url})
            return FakeResponse(
                200,
                {
                    **_payment_payload(
                        reference=captured["reference"],
                        order=captured["order"],
                        payment_id="987655",
                    ),
                },
            )
        raise AssertionError(f"Unexpected Mercado Pago request: {normalized_method} {url}")

    mp.httpx.request = fake_request
    try:
        customer_headers, store, address_id = _prepare_customer_checkout(client)
        merchant_headers = _login(client, "merchant@kepedimos.example.com", "merchant123")
        _create_smoke_promotion(client, merchant_headers)

        products_response = client.get("/api/v1/merchant/products", headers=merchant_headers)
        products_response.raise_for_status()
        products = {item["name"]: item for item in products_response.json()}

        client.post(
            "/api/v1/cart/items",
            headers=customer_headers,
            json={"store_id": store["id"], "product_id": products["Yerba Premium 1kg"]["id"], "quantity": 1},
        ).raise_for_status()
        client.post(
            "/api/v1/cart/items",
            headers=customer_headers,
            json={"store_id": store["id"], "product_id": products["Gaseosa Cola 1.5L"]["id"], "quantity": 1},
        ).raise_for_status()

        checkout = client.post(
            "/api/v1/checkout",
            headers=customer_headers,
            json={
                "store_id": store["id"],
                "address_id": address_id,
                "delivery_mode": "delivery",
                "payment_method": "mercadopago",
            },
        )
        checkout.raise_for_status()
        checkout_payload = checkout.json()
        captured["reference"] = checkout_payload["payment_reference"]
        assert checkout_payload["checkout_url"] is not None
        assert len(captured["payloads"]) == 2
        assert any(float(item["unit_price"]) < 0 for item in captured["payloads"][0]["items"])
        assert all(float(item["unit_price"]) >= 0 for item in captured["payloads"][1]["items"])
        assert captured["requests"][0]["authorization"] == "Bearer TEST-ACCESS-TOKEN-1234"
        assert captured["requests"][1]["authorization"] == "Bearer TEST-ACCESS-TOKEN-1234"

        order = client.get(f"/api/v1/orders/{checkout_payload['order_id']}", headers=customer_headers)
        order.raise_for_status()
        order_payload = order.json()
        captured["order"] = order_payload
        _assert_split_payload(captured["payloads"][1], order_payload)

        _approve_checkout_order(
            client,
            store_id=store["id"],
            reference=captured["reference"],
            payment_id="987655",
            include_query_context=False,
        )
    finally:
        mp.httpx.request = original_request


def main() -> None:
    from fastapi.testclient import TestClient

    from app.main import app
    from app.services import mercadopago as mp

    DB_PATH.unlink(missing_ok=True)

    with TestClient(app) as client:
        _run_delivery_split_scenario(client, mp)
        _run_promotions_fallback_scenario(client, mp)

    print("smoke_mercadopago_real_checkout_webhook_ok")


if __name__ == "__main__":
    configure_environment()
    main()
